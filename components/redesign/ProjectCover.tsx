"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";

const TITLE_COLOR = "#ECEDEF";
const BODY_COLOR = "#D1D5DB";

const titleFontStack = '"PP Neue Montreal", ui-sans-serif, system-ui, sans-serif';

export function ProjectCover({
  metadataLine,
  title,
  bodyMarkdown,
  footer,
}: {
  metadataLine: string;
  title: string;
  bodyMarkdown: string;
  footer?: ReactNode;
}) {
  const md = bodyMarkdown.trim() || "_No summary yet._";

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-2 px-8 pt-8 pb-10">
          <p className="text-[13px] leading-snug text-zinc-400">{metadataLine}</p>

          <h1
            className="h-[34px] w-full max-w-[344px] shrink-0 truncate text-[28px] font-medium leading-[34px]"
            style={{ fontFamily: titleFontStack, color: TITLE_COLOR }}
          >
            {title.trim() ? title : "Untitled project"}
          </h1>

          <div className="min-w-0 pt-0">
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2
                    className="mb-2 mt-6 text-base font-bold first:mt-0"
                    style={{ color: TITLE_COLOR }}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    className="mb-2 mt-6 text-base font-bold first:mt-0"
                    style={{ color: TITLE_COLOR }}
                  >
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p
                    className="mb-6 text-[15px] leading-[1.5] last:mb-0"
                    style={{ color: BODY_COLOR }}
                  >
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold" style={{ color: TITLE_COLOR }}>
                    {children}
                  </strong>
                ),
                ul: ({ children }) => (
                  <ul
                    className="mb-6 list-disc pl-5 text-[15px] leading-[1.5] last:mb-0"
                    style={{ color: BODY_COLOR }}
                  >
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol
                    className="mb-6 list-decimal pl-5 text-[15px] leading-[1.5] last:mb-0"
                    style={{ color: BODY_COLOR }}
                  >
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="mb-1">{children}</li>,
              }}
            >
              {md}
            </ReactMarkdown>
          </div>

          {footer ? <div className="mt-2 shrink-0">{footer}</div> : null}
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 shrink-0 bg-gradient-to-t from-[#878B8A] to-transparent"
        aria-hidden
      />
    </div>
  );
}
