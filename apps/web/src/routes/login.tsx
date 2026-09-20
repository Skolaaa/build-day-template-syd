import { Show, SignIn, useUser } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="page-wrap flex min-h-[calc(100vh-13rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md bg-paper-raised ring-rule">
        <Show when="signed-out">
          <CardHeader>
            <p className="kicker">Life on a Shelf</p>
            <CardTitle className="display-title font-normal text-[28px] text-ink">
              Sign in to your shelf
            </CardTitle>
            <CardDescription className="text-ink-soft">
              Your pages are where you left them. Sign in with the account you
              wrote them with.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5">
            <SignIn routing="hash" />
            {import.meta.env.DEV ? (
              <Button asChild size="sm" variant="outline">
                <a href="/api/dev-login">Dev login (local only)</a>
              </Button>
            ) : null}
            <p className="m-0 text-center text-[12.5px] text-ink-faint">
              Private by design: nothing here is shared, sold or indexed.
            </p>
          </CardContent>
        </Show>

        <Show when="signed-in">
          <SignedInGreeting />
        </Show>
      </Card>
    </main>
  );
}

function SignedInGreeting() {
  const { user } = useUser();
  if (!user) {
    return null;
  }

  const email = user.primaryEmailAddress?.emailAddress;
  const initial = (user.firstName || email || "U").charAt(0).toUpperCase();

  return (
    <>
      <CardHeader>
        <p className="kicker">Life on a Shelf</p>
        <CardTitle className="display-title font-normal text-[28px] text-ink">
          Welcome back
        </CardTitle>
        <CardDescription className="text-ink-soft">
          You're signed in as {email}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage alt="" src={user.imageUrl} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate font-medium text-sm">
              {user.firstName} {user.lastName}
            </p>
            <p className="m-0 truncate text-ink-faint text-xs">{email}</p>
          </div>
        </div>
        <p className="m-0 text-[12.5px] text-ink-faint">
          Manage your account from the avatar in the header.
        </p>
      </CardContent>
    </>
  );
}
