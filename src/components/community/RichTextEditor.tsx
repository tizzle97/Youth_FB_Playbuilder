import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Underline as UnderlineIcon, List } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Applied to the actual editable element, so a <label htmlFor> can point
   *  at it like it would a native input/textarea. */
  id?: string;
}

/**
 * A deliberately small rich-text editor for Community post content: bold,
 * underline, and a bullet list — nothing else. StarterKit's other nodes
 * (headings, italic, strike, code, blockquote, horizontal rule, ordered
 * list) are disabled below, so the editor's schema can only ever produce
 * the same tags sanitizePostContent() allows through — on paste (including
 * from Word) as much as on typing, since Tiptap parses pasted HTML through
 * this same restricted schema rather than accepting it verbatim.
 */
export function RichTextEditor({ value, onChange, placeholder, id }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        orderedList: false,
        // underline stays enabled — StarterKit bundles it directly in this
        // version (@tiptap/extension-underline is not needed as a separate
        // dependency; adding it too just registers a duplicate 'underline'
        // extension, which silently breaks toggling).
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: 'community-post-content min-h-[8rem] focus:outline-none',
      },
    },
  });

  if (!editor) return null;

  const toolBtn = (active: boolean) =>
    `p-2 rounded-lg transition-colors ${active ? 'bg-primary/20 text-primary' : 'text-chalk/60 hover:text-chalk hover:bg-white/10'}`;

  // Clicking a <button> natively moves focus to it on mousedown, before the
  // onClick handler below ever runs — which would steal focus away from the
  // editor out from under the very "refocus" chain() call meant to prevent
  // that, racing whatever the user types next. preventDefault on mousedown
  // stops the browser from shifting focus at all, so the editor never loses
  // it in the first place. Standard Tiptap toolbar pattern.
  const preventFocusSteal = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="rounded-md border border-chalk/20 bg-board shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-chalk/10">
        <button
          type="button"
          onMouseDown={preventFocusSteal}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          className={toolBtn(editor.isActive('bold'))}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={preventFocusSteal}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
          className={toolBtn(editor.isActive('underline'))}
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={preventFocusSteal}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
          className={toolBtn(editor.isActive('bulletList'))}
        >
          <List className="h-4 w-4" />
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="px-4 py-2 text-chalk [&_.ProseMirror]:min-h-[8rem] [&_.ProseMirror]:outline-none [&_.is-editor-empty:first-child::before]:text-chalk/50 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  );
}
