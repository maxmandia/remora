import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@remora/ui";

export function GuestGenerationAuthDialog({
  open,
  onClose,
  onCreateAccount,
  onSignIn,
}: {
  open: boolean;
  onClose: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent aria-label="Continue your guest generation">
        <DialogHeader>
          <DialogTitle>Create an account to continue</DialogTitle>
          <DialogDescription>
            Sign up or sign in to continue with your generation.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onSignIn}>
            Sign in
          </Button>
          <Button type="button" onClick={onCreateAccount}>
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
