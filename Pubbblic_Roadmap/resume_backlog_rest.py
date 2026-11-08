#!/usr/bin/env python3
"""Resume Pubbblic backlog through GitHub REST API, avoiding GraphQL issue-create.

Phases: issues -> parents -> dependencies -> audit.
Safe by default (preview). Idempotent via live GitHub checks on each invocation.
Requires authenticated gh CLI with Issues write access; run with
GH_TOKEN/GITHUB_TOKEN unset if the Codespaces injected token lacks permissions.
"""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ISSUES = json.loads((HERE / "issues.json").read_text(encoding="utf-8"))["issues"]
MILESTONES = json.loads((HERE / "milestones.json").read_text(encoding="utf-8"))
TITLE_RE = re.compile(r"^\[(PUB-\d{2}(?:\.\d{2})?)\]\s")

class ApiError(RuntimeError):
    pass

def gh_api(method, path, payload=None):
    cmd = ["gh", "api", "-X", method, "-H",
           "Accept: application/vnd.github+json", path]
    if payload is not None:
        cmd += ["--input", "-"]
    result = subprocess.run(
        cmd, input=json.dumps(payload) if payload is not None else None,
        capture_output=True, text=True, encoding="utf-8"
    )
    if result.returncode:
        raise ApiError(f"{method} {path}\n{result.stderr.strip()[:1200]}")
    try:
        return json.loads(result.stdout) if result.stdout.strip() else None
    except json.JSONDecodeError as exc:
        raise ApiError(f"Invalid API response for {method} {path}") from exc

def get_all(path):
    results = []
    page = 1
    while True:
        sep = "&" if "?" in path else "?"
        chunk = gh_api("GET", f"{path}{sep}per_page=100&page={page}")
        if not isinstance(chunk, list):
            raise ApiError(f"Expected list response from {path}")
        results.extend(chunk)
        if len(chunk) < 100:
            return results
        page += 1

def existing_issues(repo):
    found = {}
    for row in get_all(f"repos/{repo}/issues?state=all"):
        if "pull_request" in row:
            continue
        match = TITLE_RE.match(row.get("title", ""))
        if match:
            key = match.group(1)
            if key in found:
                raise ApiError(f"Duplicate issue ID {key} on GitHub; reconcile before continuing")
            found[key] = row
    return found

def milestone_ids(repo):
    actual = {m["title"]: m["number"] for m in get_all(f"repos/{repo}/milestones?state=all")}
    missing = [m["title"] for m in MILESTONES if m["title"] not in actual]
    if missing:
        raise ApiError("Missing milestones: " + ", ".join(missing))
    return {m["gate"]: actual[m["title"]] for m in MILESTONES}

def issue_payload(row, current, milestones):
    body = row["body"]
    for dep in row.get("dependencies", []):
        if dep in current:
            body = body.replace(f"- {dep}\n", f'- #{current[dep]["number"]} ({dep})\n')
    return {
        "title": row["full_title"], "body": body,
        "milestone": milestones[row["gate"]], "labels": row["labels"],
    }

def create_issues(repo, current, milestones, apply, limit, delay):
    missing = [r for r in ISSUES if r["id"] not in current]
    print(f"Issues present: {len(current)}/{len(ISSUES)}; missing: {len(missing)}", flush=True)
    batch = missing[:limit]
    for i, row in enumerate(batch, 1):
        if apply:
            result = gh_api("POST", f"repos/{repo}/issues",
                            issue_payload(row, current, milestones))
            if result.get("title") != row["full_title"]:
                raise ApiError("Unexpected issue title returned; inspect before resuming")
            current[row["id"]] = result
            print(f"[{i}/{len(batch)}] CREATED {row['id']} #{result['number']}", flush=True)
            time.sleep(delay)
        else:
            print(f"[{i}/{len(batch)}] WOULD CREATE {row['id']}", flush=True)
    print(f"Batch: {len(batch) if apply else 0} written; "
          f"remaining: {len(missing)-len(batch) if apply else len(missing)}", flush=True)

def add_parents(repo, current, apply, limit, delay):
    if len(current) != len(ISSUES):
        raise ApiError("Create every issue before adding parent-child links")
    cache = {}
    changed = 0
    for row in ISSUES:
        if row["type"] != "task":
            continue
        parent = current[row["epic"]]
        child = current[row["id"]]
        number = parent["number"]
        if number not in cache:
            cache[number] = {x["id"] for x in get_all(
                f"repos/{repo}/issues/{number}/sub_issues")}
        if child["id"] in cache[number]:
            continue
        if changed >= limit:
            break
        if apply:
            gh_api("POST", f"repos/{repo}/issues/{number}/sub_issues",
                   {"sub_issue_id": child["id"]})
            cache[number].add(child["id"])
            print(f"ATTACHED {row['id']} -> {row['epic']}", flush=True)
            time.sleep(delay)
        else:
            print(f"WOULD ATTACH {row['id']} -> {row['epic']}", flush=True)
        changed += 1
    print(f"Parent links: {changed} {'created' if apply else 'planned'}; "
          "repeat until zero", flush=True)

def add_dependencies(repo, current, apply, limit, delay):
    if len(current) != len(ISSUES):
        raise ApiError("Create every issue before adding dependencies")
    changed = 0
    for row in ISSUES:
        deps = row.get("dependencies", [])
        if not deps:
            continue
        number = current[row["id"]]["number"]
        already = {r["id"] for r in get_all(
            f"repos/{repo}/issues/{number}/dependencies/blocked_by")}
        for dep in deps:
            blocker = current[dep]["id"]
            if blocker in already:
                continue
            if changed >= limit:
                print(f"Dependencies created/planned this batch: {changed}; repeat", flush=True)
                return
            if apply:
                gh_api("POST", f"repos/{repo}/issues/{number}/dependencies/blocked_by",
                       {"issue_id": blocker})
                already.add(blocker)
                print(f"BLOCKED: {row['id']} by {dep}", flush=True)
                time.sleep(delay)
            else:
                print(f"WOULD BLOCK: {row['id']} by {dep}", flush=True)
            changed += 1
    print(f"Dependency links: {changed} {'created' if apply else 'planned'}; "
          "repeat until zero", flush=True)

def audit(repo, current):
    missing = [r["id"] for r in ISSUES if r["id"] not in current]
    print(f"Issue audit: {len(current)}/{len(ISSUES)}; missing: {missing[:20]}", flush=True)
    if missing:
        return
    child_ids = set()
    for epic in [r for r in ISSUES if r["type"] == "epic"]:
        for child in get_all(f"repos/{repo}/issues/{current[epic['id']]['number']}/sub_issues"):
            child_ids.add(child["id"])
    expected = {current[r["id"]]["id"] for r in ISSUES if r["type"] == "task"}
    actual_dep = 0
    missing_deps = []
    for row in ISSUES:
        deps = row.get("dependencies", [])
        if not deps:
            continue
        observed = {i["id"] for i in get_all(
            f"repos/{repo}/issues/{current[row['id']]['number']}/dependencies/blocked_by")}
        for dep in deps:
            if current[dep]["id"] in observed:
                actual_dep += 1
            else:
                missing_deps.append((row["id"], dep))
    print(f"Parent-child links: {len(expected & child_ids)}/{len(expected)}", flush=True)
    print(f"Blocking links: {actual_dep}/{sum(len(r.get('dependencies', [])) for r in ISSUES)}", flush=True)
    if missing_deps:
        print(f"Outstanding blocking links: {len(missing_deps)}; examples: {missing_deps[:5]}", flush=True)
    if expected == child_ids and not missing_deps:
        print("PASS: all issue IDs and relationships verified.", flush=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner", default="QaloriHQ")
    parser.add_argument("--repo", default="Pubbblic")
    parser.add_argument("--phase", choices=("issues", "parents", "dependencies", "audit"), default="issues")
    parser.add_argument("--max-writes", type=int, default=20)
    parser.add_argument("--delay", type=float, default=5.0)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.max_writes < 1 or args.delay < 1:
        parser.error("At least one write and at least one second delay required")
    repo = f"{args.owner}/{args.repo}"
    print(f"Pubbblic REST importer | {repo} | {args.phase} | "
          f"{'APPLY' if args.apply else 'PREVIEW'}", flush=True)
    current = existing_issues(repo)
    if args.phase == "issues":
        create_issues(repo, current, milestone_ids(repo), args.apply, args.max_writes, args.delay)
    elif args.phase == "parents":
        add_parents(repo, current, args.apply, args.max_writes, args.delay)
    elif args.phase == "dependencies":
        add_dependencies(repo, current, args.apply, args.max_writes, args.delay)
    else:
        audit(repo, current)

if __name__ == "__main__":
    try:
        main()
    except (ApiError, ValueError, KeyError) as exc:
        print("STOP: " + str(exc), file=sys.stderr)
        print("Honor GitHub rate-limit retry guidance before rerunning.", file=sys.stderr)
        sys.exit(1)
