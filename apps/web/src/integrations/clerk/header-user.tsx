import { Show, UserButton } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { Button } from "#/components/ui/button";

export default function HeaderUser() {
  return (
    <>
      <Show when="signed-in">
        <span className="ml-1 inline-flex items-center">
          <UserButton />
        </span>
      </Show>
      <Show when="signed-out">
        <Button asChild size="sm" variant="outline">
          <Link to="/login">
            <LogIn data-icon="inline-start" />
            Sign in
          </Link>
        </Button>
      </Show>
    </>
  );
}
