'use client'

import { useEffect } from 'react'
import Link from '@tiptap/extension-link'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function KnowledgeEditor({
  content,
  editable,
  onChange,
  className,
}: {
  content: string
  editable: boolean
  onChange?: (html: string) => void
  className?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
    ],
    content: content || '<p></p>',
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[280px] px-3 py-2 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange?.(current.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    if (!editor) return
    const next = content || '<p></p>'
    if (editor.getHTML() === next) return
    editor.commands.setContent(next, { emitUpdate: false })
  }, [content, editor])

  if (!editor) return null

  return (
    <div className={cn('overflow-hidden rounded-md border border-border', className)}>
      {editable ? (
        <div className="flex flex-wrap gap-0.5 border-b border-border bg-muted/40 p-1">
          <Tool
            label="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldIcon className="size-3.5" />
          </Tool>
          <Tool
            label="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon className="size-3.5" />
          </Tool>
          <Tool
            label="Heading"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2Icon className="size-3.5" />
          </Tool>
          <Tool
            label="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <ListIcon className="size-3.5" />
          </Tool>
          <Tool
            label="Numbered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrderedIcon className="size-3.5" />
          </Tool>
          <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2Icon className="size-3.5" />
          </Tool>
          <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2Icon className="size-3.5" />
          </Tool>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}

function Tool({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={active ? 'secondary' : 'ghost'}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
