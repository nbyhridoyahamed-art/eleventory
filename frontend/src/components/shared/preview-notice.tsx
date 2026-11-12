import { Alert, AlertDescription } from "@/components/ui/alert";

/** Marks a screen that is designed but not wired to the backend yet. */
export function PreviewNotice({ children }: { children?: React.ReactNode }) {
  return (
    <Alert variant="info">
      <AlertDescription>
        <strong>Preview.</strong> {children ?? "This screen shows sample data. Saving is not connected yet."}
      </AlertDescription>
    </Alert>
  );
}
