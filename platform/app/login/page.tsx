import { LoginForm } from "@/components/LoginForm";
import { Suspense } from "react";
export const metadata = { title: "Sign in | Pubbblic Studio", robots: { index: false, follow: false } };
export default function Login() { return <Suspense fallback={<div>Loading sign-in…</div>}><LoginForm/></Suspense>; }
