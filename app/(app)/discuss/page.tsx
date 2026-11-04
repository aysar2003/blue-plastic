import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DISCUSS_LEGAL, extractMentions } from '@/lib/erp/discuss-mentions'
import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

import { createChannel, pinMessage, postMessage } from './actions'

export const metadata: Metadata = { title: 'Discuss' }

export default async function DiscussPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>
}) {
  const ctx = await requireOrgContext('knowledge:read')
  const { channel: channelId } = await searchParams
  const channels = await collab.listChannels(ctx)
  const active = channelId ?? channels[0]?.id
  const messages = active ? await collab.listMessages(ctx, active) : []
  const roots = messages.filter((m) => !m.parentId)
  const replies = new Map<string, typeof messages>()
  for (const message of messages) {
    if (!message.parentId) continue
    const list = replies.get(message.parentId) ?? []
    list.push(message)
    replies.set(message.parentId, list)
  }

  return (
    <>
      <PageHeader title="Discuss" description="Team channels with threads, pins, and @mentions." />
      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">{DISCUSS_LEGAL}</p>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="space-y-3 p-3">
          <form action={createChannel} className="flex gap-1">
            <Input name="name" placeholder="New channel" required className="h-8" />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
          <ul className="space-y-1 text-sm">
            {channels.map((ch) => (
              <li key={ch.id}>
                <a
                  href={`/discuss?channel=${ch.id}`}
                  className={active === ch.id ? 'font-semibold text-primary' : 'text-muted-foreground'}
                >
                  #{ch.name}
                  <span className="ml-1 text-xs">({ch._count.messages})</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex min-h-[320px] flex-col p-4">
          <ul className="mb-4 flex-1 space-y-3 overflow-y-auto text-sm">
            {roots.map((m) => (
              <li key={m.id} className="rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{m.author.name}</span>
                    {m.pinnedAt ? (
                      <span className="text-muted-foreground ml-2 text-xs">pinned</span>
                    ) : null}
                  </span>
                  {active ? (
                    <form action={pinMessage}>
                      <input type="hidden" name="channelId" value={active} />
                      <input type="hidden" name="messageId" value={m.id} />
                      <input type="hidden" name="pinned" value={m.pinnedAt ? '0' : '1'} />
                      <Button type="submit" size="sm" variant="ghost">
                        {m.pinnedAt ? 'Unpin' : 'Pin'}
                      </Button>
                    </form>
                  ) : null}
                </div>
                <p>{m.body}</p>
                {extractMentions(m.body).length > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Mentions: {extractMentions(m.body).map((name) => `@${name}`).join(' ')}
                  </p>
                ) : null}
                <ul className="mt-2 space-y-1 border-l pl-3">
                  {(replies.get(m.id) ?? []).map((reply) => (
                    <li key={reply.id}>
                      <span className="font-medium">{reply.author.name}</span>
                      <span className="text-muted-foreground"> · {reply.body}</span>
                    </li>
                  ))}
                </ul>
                {active ? (
                  <form action={postMessage} className="mt-2 flex gap-2">
                    <input type="hidden" name="channelId" value={active} />
                    <input type="hidden" name="parentId" value={m.id} />
                    <Input name="body" placeholder="Reply…" required className="flex-1" />
                    <Button type="submit" size="sm" variant="secondary">
                      Reply
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
            {messages.length === 0 ? (
              <li className="text-muted-foreground">No messages yet.</li>
            ) : null}
          </ul>
          {active ? (
            <form action={postMessage} className="flex gap-2">
              <input type="hidden" name="channelId" value={active} />
              <Input name="body" placeholder="Message…" required className="flex-1" />
              <Button type="submit" size="sm">
                Send
              </Button>
            </form>
          ) : null}
        </Card>
      </div>
    </>
  )
}
