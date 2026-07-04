"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef } from "react";

function getMarkdown(ed: Editor): string {
  const storage = ed.storage as {
    markdown?: { getMarkdown?: () => string };
  };
  return storage.markdown?.getMarkdown?.() ?? "";
}

type MarkdownEditorProps = {
  value: string;
  onChange?: (markdown: string) => void;
  /** Called when focus leaves the editor (good place to persist). */
  onBlur?: (markdown: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * Tiptap-based rich text editor that reads/writes Markdown. Used for task
 * descriptions; the agent writes the same Markdown so humans and agents share
 * one format.
 */
export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  editable = true,
  className = "",
}: MarkdownEditorProps) {
  const lastEmitted = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Markdown.configure({ html: false, linkify: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `julow-prose ${className}`.trim(),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = getMarkdown(ed);
      lastEmitted.current = md;
      onChange?.(md);
    },
    onBlur: ({ editor: ed }) => {
      onBlur?.(getMarkdown(ed));
    },
  });

  // Sync external value changes (e.g. switching tasks) without clobbering edits.
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  return <EditorContent editor={editor} />;
}
