import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeChooser } from "@/features/settings/components/theme-chooser";

export const metadata: Metadata = { title: "Appearance" };

export default function AppearanceSettingsPage() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Theme</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose how FlowDesk looks. System follows your device setting.
        </p>
      </CardHeader>
      <CardContent>
        <ThemeChooser />
      </CardContent>
    </Card>
  );
}
