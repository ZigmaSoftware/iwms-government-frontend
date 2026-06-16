import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-muted/30 p-6 text-center">
      <div className="space-y-4">
        <p className="text-7xl font-black tracking-tight text-primary/70">404</p>
        <p className="text-lg text-muted-foreground">
          We could not find the page you were looking for.
        </p>
        <div className="flex items-center justify-center gap-3 text-sm">
          <Link className="text-primary underline" to="/">
            Go to dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link className="text-primary underline" to="/auth">
            Go to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
