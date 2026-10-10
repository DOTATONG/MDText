export type MarkdownPreviewLabels = {
  copyCode: string
  copiedCode: string
  plainCodeBlock: string
  codeBlock: (language: string) => string
  mermaidDiagram: string
  mermaidLoading: string
  mermaidError: string
  openMermaidPreview: string
  closeMermaidPreview: string
  previewZoomIn: string
  previewZoomOut: string
  previewReset: string
  previewInteractionHint: string
  imagePreview: string
  closeImagePreview: string
  imagePreviewAlt: (alt: string) => string
}
