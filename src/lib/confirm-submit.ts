/**
 * Gates a `<form action={formAction}>` Server Action submission behind a
 * native confirm() — same mechanism this app already used for onClick-
 * triggered mutations (delete buttons etc.), just wired to a form's
 * onSubmit instead of a click handler. Calling preventDefault() here stops
 * the action from firing at all, per React's documented pattern for
 * conditionally submitting an action-bound form.
 */
export function confirmSubmit(message: string) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    if (!confirm(message)) {
      event.preventDefault();
    }
  };
}
