import { type Editor } from "@tiptap/react"
import { getSelectedDOMElement } from "@/lib/tiptap-advanced-utils"

/**
 * Computes the content-area rect of the editor (excluding padding/border).
 * @param editorDom
 * @returns
 */
export function getEditorContentRect(editorDom: HTMLElement) {
  const editorRect = editorDom.getBoundingClientRect()
  const style = getComputedStyle(editorDom)

  const paddingLeft = parseFloat(style.paddingLeft)
  const paddingRight = parseFloat(style.paddingRight)
  const borderLeft = parseFloat(style.borderLeftWidth)
  const borderRight = parseFloat(style.borderRightWidth)

  const left = editorRect.left + borderLeft + paddingLeft
  const width =
    editorRect.width - paddingLeft - paddingRight - borderLeft - borderRight

  return { left, width }
}

/**
 * Creates a full-width anchor rect spanning the editor's content area at a given vertical position.
 * @param editorDom
 * @param sourceRect
 * @returns
 */
export function createEditorWidthAnchorRect(
  editorDom: HTMLElement,
  sourceRect: DOMRect
): DOMRect {
  const { left, width } = getEditorContentRect(editorDom)
  return new DOMRect(left, sourceRect.top, width, sourceRect.height)
}

/**
 * Gets the bounding rect of the current text selection using the browser's
 * Selection API, falling back to ProseMirror coordinates.
 */
export function getSelectionRangeRect(editor: Editor): DOMRect | null {
  const { state } = editor
  const { selection } = state

  if (selection.empty) return null

  const domSelection = window.getSelection()
  const editorDom = editor.view.dom as HTMLElement

  if (domSelection && domSelection.rangeCount > 0 && editorDom) {
    const range = domSelection.getRangeAt(0)
    const commonAncestor = range.commonAncestorContainer

    if (commonAncestor && editorDom.contains(commonAncestor)) {
      const rect = range.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        return rect
      }
    }
  }

  // Fallback: use ProseMirror coordinates
  const fromCoords = editor.view.coordsAtPos(selection.from)
  const toCoords = editor.view.coordsAtPos(selection.to)

  return new DOMRect(
    Math.min(fromCoords.left, toCoords.left),
    Math.min(fromCoords.top, toCoords.top),
    Math.abs(toCoords.right - fromCoords.left),
    Math.abs(toCoords.bottom - fromCoords.top)
  )
}

/**
 * Creates a virtual anchor element that reports a bounding rect.
 * When a referenceElement is provided, the anchor tracks scroll by storing
 * the offset relative to the reference and computing fresh viewport
 * coordinates on each getBoundingClientRect() call.
 */
export function createVirtualAnchor(
  rect: DOMRect,
  referenceElement?: HTMLElement | null
): HTMLElement {
  const anchor = document.createElement("div")
  Object.assign(anchor.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "0",
    height: "0",
    pointerEvents: "none",
    opacity: "0",
    zIndex: "-1",
  })

  if (referenceElement) {
    // Store the offset relative to the reference element so that
    // getBoundingClientRect dynamically adjusts when the user scrolls.
    const refRect = referenceElement.getBoundingClientRect()
    const offsetTop = rect.top - refRect.top
    const offsetLeft = rect.left - refRect.left

    anchor.getBoundingClientRect = () => {
      const currentRefRect = referenceElement.getBoundingClientRect()
      return new DOMRect(
        currentRefRect.left + offsetLeft,
        currentRefRect.top + offsetTop,
        rect.width,
        rect.height
      )
    }
  } else {
    anchor.getBoundingClientRect = () => rect
  }
  anchor.setAttribute("data-fallback-anchor", "true")
  document.body.appendChild(anchor)
  return anchor
}

export function getContextAndInsertAt(editor: Editor) {
  let context: string | undefined = ""
  let insertAt = { from: 0, to: 0 }
  let isSelection = true
  const generatedWith = editor.storage.ai.generatedWith

  if (generatedWith && generatedWith.range) {
    context = editor.storage.ai.response
    insertAt = generatedWith.range
    isSelection = false
  }

  if (!generatedWith || !generatedWith.range) {
    const { state } = editor
    const { selection } = state
    const { from, to } = editor.state.selection

    const selectionContent = selection.content()

    const htmlContent =
      editor.view.serializeForClipboard(selectionContent).dom.innerHTML
    const textContent = selectionContent.content.textBetween(
      0,
      selectionContent.content.size,
      "\n"
    )

    context = htmlContent || textContent
    insertAt = { from, to }
  }

  return { context, insertAt, isSelection }
}

export function createPositionAnchor(rect: DOMRect): HTMLElement {
  const anchor = document.createElement("div")
  Object.assign(anchor.style, {
    position: "absolute",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: "none",
    opacity: "0",
    zIndex: "-1",
  })

  anchor.setAttribute("data-fallback-anchor", "true")
  document.body.appendChild(anchor)
  return anchor
}

export function cleanupFallbackAnchors(): void {
  document
    .querySelectorAll('[data-fallback-anchor="true"]')
    .forEach((el) => el.remove())
}

export function getTopMostParentInsideEditor(
  element: HTMLElement,
  editorRoot: HTMLElement
): HTMLElement {
  if (!element || !editorRoot) {
    throw new Error("Both element and editorRoot must be provided")
  }

  if (element === editorRoot) return element

  if (!editorRoot.contains(element)) {
    throw new Error("Element is not inside the editor root")
  }

  let parent = element
  while (parent.parentElement && parent.parentElement !== editorRoot) {
    parent = parent.parentElement
  }

  return parent
}

export function findAiMarkedDOMElement(editor: Editor): HTMLElement | null {
  const view = editor.view
  const aiMarkedElements = view.dom.querySelectorAll(
    ".tiptap-ai-insertion"
  ) as NodeListOf<HTMLElement>

  if (aiMarkedElements.length === 0) return null

  const lastAiMarkElement = aiMarkedElements[aiMarkedElements.length - 1]

  if (lastAiMarkElement && view.dom) {
    try {
      return getTopMostParentInsideEditor(lastAiMarkElement, view.dom)
    } catch {
      return lastAiMarkElement || null
    }
  }

  return lastAiMarkElement || null
}

export function findPrioritizedAIElement(editor: Editor): HTMLElement | null {
  // AI marked elements
  const aiMarkedElement = findAiMarkedDOMElement(editor)
  if (aiMarkedElement) {
    return aiMarkedElement
  }

  // Currently selected element
  const selectedElement = getSelectedDOMElement(editor)
  if (selectedElement) {
    return selectedElement
  }

  return null
}
