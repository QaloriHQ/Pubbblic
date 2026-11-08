#!/usr/bin/env python3
"""Resume Pubbblic backlog through GitHub REST API, avoiding GraphQL issue-create.

Phases: issues -> parents -> dependencies -> audit.
Safe by default (preview). Idempotent via live GitHub checks on each invocation.
Requires `gh auth login` with Issues write access; run with GH_TOKEN/GITHUB_TOKEN unset
if the Codespaces injected token lacks permissions.
"""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ISSUES = json.loads((HERE / 'issues.json').read_text(encoding='utf-8'))['issues']
MILESTONES = json.loads((HERE / 'milestones.json').read_text(encoding='utf-8'))
TITLE_RE = re.compile(r'^\[(PUB-\d{2}(?:\.\d{2})?)\]\s')

class ApiError(RuntimeError):
    pass


def gh_api(method, path, payload=None):
    cmd = ['gh', 'api', '-X', method, '-H', 'Accept: application/vnd.github+json',
           '-H', 'X-GitHub-Api-Version: 2026-03-10', path]
    if payload is not None:
        cmd += ['--input', '-']
    p = subprocess.run(cmd, input=json.dumps(payload) if payload is not None else None,
                       capture_output=True, text=True, encoding='utf-8')
    if p.returncode:
        raise ApiError(f'{method} {path}\n{p.stderr.strip()[:1200]}')
    try:
        return json.loads(p.stdout) if p.stdout.strip() else None
    except json.JSONDecodeError as exc:
        raise ApiError(f'Unexpected response from {method} {path}: {p.stdout[:250]}') from exc


def get_all(path):
    results = []
    page = 1
    while True:
        sep = '&' if '?' in path else '?'
        chunk = gh_api('GET', f'{path}{sep}per_page=100&page={page}')
        if not isinstance(chunk, list):
            raise ApiError('Expected an array from ' + path)
        results.extend(chunk)
        if len(chunk) < 100:
            return results
        page += 1


def existing_issues(repo):
    by_key = {}
    for row in get_all(f'repos/{repo}/issues?state=all'):
        if 'pull_request' in row:
            continue
        match = TITLE_RE.match(row.get('title', ''))
        if match:
            key = match.group(1)
            if key in by_key:
                raise ApiError(f'Duplicate {key} detected on GitHub. Stop and reconcile before writing.')
            by_key[key] = row
    return by_key


def milestone_ids(repo):
    actual = {m['title']: m['number'] for m in get_all(f'repos/{repo}/milestones?state=all')}
    missing = [m['title'] for m in MILESTONES if m['title'] not in actual]
    if missing:
        raise ApiError('Milestones missing (run original bootstrap first): ' + ', '.join(missing))
    return {m['gate']: actual[m['title']] for m in MILESTONES}


def rendered_body(row, current):
    body = row['body']
    for dep in row.get('dependencies', []):
        if dep in current:
            body = body.replace(f'- {dep}\n', f'- #{current[dep]["number"]} ({dep})\n')
    return body


def issue_payload(row, current, milestones):
    return {'title': row['full_title'], 'body': rendered_body(row, current),
            'milestone': milestones[row['gate']], 'labels': row['labels']}


def create_issues(repo, current, milestones, apply, limit, delay):
    missing = [row for row in ISSUES if row['id'] not in current]
    print(f'Issues on GitHub: {len(current)}/138. Missing: {len(missing)}.', flush=True)
    to_process = missing[:limit]
    for i, row in enumerate(to_process, 1):
        payload = issue_payload(row, current, milestones)
        if apply:
            result = gh_api('POST', f'repos/{repo}/issues', payload)
            if result.get('title') != row['full_title']:
                raise ApiError('Created issue returned unexpected title; inspect manually before resuming.')
            current[row['id']] = result
            print(f'[{i}/{len(to_process)}] CREATED {row["id"]} #{result["number"]}', flush=True)
            time.sleep(delay)
        else:
            print(f'[{i}/{len(to_process)}] WOULD CREATE {row["id"]}', flush=True)
    print(f'Batch complete: {len(to_process) if apply else 0} new issues. '
          f'Remaining after batch: {len(missing)-len(to_process) if apply else len(missing)}.', flush=True)


def add_parents(repo, current, apply, limit, delay):
    if len(current) != len(ISSUES):
        raise ApiError(f'Only {len(current)}/138 issues exist. Complete --phase issues first.')
    installed = {}
    changed = 0
    for row in ISSUES:
        if row['type'] != 'task':
            continue
        parent = current[row['epic']]
        child = current[row['id']]
        parent_num = parent['number']
        if parent_num not in installed:
            installed[parent_num] = {x['id'] for x in get_all(
                f'repos/{repo}/issues/{parent_num}/sub_issues')}
        if child['id'] in installed[parent_num]:
            continue
        if changed >= limit:
            break
        if apply:
            gh_api('POST', f'repos/{repo}/issues/{parent_num}/sub_issues',
                   {'sub_issue_id': child['id']})
            installed[parent_num].add(child['id'])
            print(f'ATTACHED {row["id"]} -> {row["epic"]}', flush=True)
            time.sleep(delay)
        else:
            print(f'WOULD ATTACH {row["id"]} -> {row["epic"]}', flush=True)
        changed += 1
    print(f'Parent links: {changed} {"created" if apply else "planned"} this batch. '
          'Run this phase again until the count is zero.', flush=True)


def add_dependencies(repo, current, apply, limit, delay):
    if len(current) != len(ISSUES):
        raise ApiError(f'Only {len(current)}/138 issues exist. Complete --phase issues first.')
    changed = 0
    for row in ISSUES:
        deps = row.get('dependencies', [])
        if not deps:
            continue
        issue_number = current[row['id']]['number']
        already = {r['id'] for r in get_all(
            f'repos/{repo}/issues/{issue_number}/dependencies/blocked_by')}
        for dep in deps:
            blocking_id = current[dep]['id']
            if blocking_id in already:
                continue
            if changed >= limit:
                print(f'Dependency links: {changed} {"created" if apply else "planned"} this batch. '
                      'Run again to continue.', flush=True)
                return
            if apply:
                gh_api('POST', f'repos/{repo}/issues/{issue_number}/dependencies/blocked_by',
                       {'issue_id': blocking_id})
                already.add(blocking_id)
                print(f'BLOCKED: {row["id"]} by {dep}', flush=True)
                time.sleep(delay)
            else:
                print(f'WOULD BLOCK: {row["id"]} by {dep}', flush=True)
            changed += 1
    print(f'Dependency links: {changed} {"created" if apply else "planned"} this batch. '
          'Zero means complete.', flush=True)


def audit(repo, current):
    missing = [r['id'] for r in ISSUES if r['id'] not in current]
    print(f'Issue audit: {len(current)}/138; missing: {missing[:20]}', flush=True)
    if missing:
        return
    child_ids = set()
    for epic in [r for r in ISSUES if r['type']=='epic']:
        for child in get_all(f'repos/{repo}/issues/{current[epic["id"]]["number"]}/sub_issues'):
            child_ids.add(child['id'])
    expected_children = {current[r['id']]['id'] for r in ISSUES if r['type']=='task'}
    parent_missing = expected_children-child_ids
    actual_dep = 0
    missing_deps = []
    for row in ISSUES:
        deps = row.get('dependencies', [])
        if not deps:
            continue
        observed = {i['id'] for i in get_all(
            f'repos/{repo}/issues/{current[row["id"]]["number"]}/dependencies/blocked_by')}
        for key in deps:
            if current[key]['id'] in observed:
                actual_dep += 1
            else:
                missing_deps.append((row['id'], key))
    print(f'Parent-child links: {len(expected_children)-len(parent_missing)}/{len(expected_children)}', flush=True)
    print(f'Blocking links: {actual_dep}/{sum(len(r.get("dependencies",[])) for r in ISSUES)}', flush=True)
    if parent_missing:
        print(f'Outstanding parent-child links: {len(parent_missing)}', flush=True)
    if missing_deps:
        print(f'Outstanding blocking links: {len(missing_deps)}; first 5: {missing_deps[:5]}', flush=True)
    if not parent_missing and not missing_deps:
        print('PASS: all issue IDs, parent-child links, and blocking relationships verified.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--owner', default='QaloriHQ')
    parser.add_argument('--repo', default='Pubbblic')
    parser.add_argument('--phase', choices=('issues','parents','dependencies','audit'),default='issues')
    parser.add_argument('--max-writes', type=int, default=20)
    parser.add_argument('--delay', type=float, default=5.0)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.max_writes < 1 or args.delay < 1:
        parser.error('Must use at least one write per batch and at least 1 second between writes.')
    repo = f'{args.owner}/{args.repo}'
    print(f'Pubbblic REST importer | {repo} | {args.phase} | '
          f'{"APPLY" if args.apply else "PREVIEW"} | max writes {args.max_writes}', flush=True)
    current = existing_issues(repo)
    if args.phase == 'issues':
        create_issues(repo, current, milestone_ids(repo), args.apply, args.max_writes, args.delay)
    elif args.phase == 'parents':
        add_parents(repo, current, args.apply, args.max_writes, args.delay)
    elif args.phase == 'dependencies':
        add_dependencies(repo, current, args.apply, args.max_writes, args.delay)
    else:
        audit(repo, current)


if __name__ == '__main__':
    try:
        main()
    except (ApiError, ValueError, KeyError) as exc:
        print('STOP: ' + str(exc), file=sys.stderr)
        print('Do not immediately retry a rate-limited operation. Inspect your REST/GraphQL limits, '
              'observe GitHub retry-after/reset guidance, and rerun the same phase later. '
              'Live state checks prevent duplicate issues and links.', file=sys.stderr)
        sys.exit(1)
