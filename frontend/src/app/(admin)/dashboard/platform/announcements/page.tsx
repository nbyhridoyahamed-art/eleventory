"use client";

import { useState } from "react";

import { useAnnouncements, useDeleteAnnouncement, useSaveAnnouncement, type Announcement } from "@/hooks/use-platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AnnouncementsPage() {
  const { data } = useAnnouncements();
  const save = useSaveAnnouncement();
  const remove = useDeleteAnnouncement();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<Announcement["level"]>("info");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>New announcement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should merchants know?" aria-label="Message" rows={3} />
          <div className="flex items-center gap-3">
            <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm" value={level} onChange={(e) => setLevel(e.target.value as Announcement["level"])} aria-label="Level">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <Button
              disabled={!title.trim() || !body.trim() || save.isPending}
              onClick={() => save.mutate({ title: title.trim(), body: body.trim(), level, is_active: true }, { onSuccess: () => { setTitle(""); setBody(""); } })}
            >
              Publish to all merchants
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(data ?? []).map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-5 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{a.title}</span>
                  <Badge variant={a.level === "critical" ? "danger" : a.level === "warning" ? "warning" : "info"}>{a.level}</Badge>
                  {!a.is_active ? <Badge variant="neutral">hidden</Badge> : null}
                </div>
                <p className="mt-1 text-text-secondary">{a.body}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => save.mutate({ id: a.id, title: a.title, body: a.body, level: a.level, is_active: !a.is_active })}>
                  {a.is_active ? "Hide" : "Show"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { if (window.confirm("Delete this announcement?")) remove.mutate(a.id); }}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
