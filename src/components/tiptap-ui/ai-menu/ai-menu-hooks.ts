import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { type Editor } from "@tiptap/react"
import type { Transaction } from "@tiptap/pm/state"
import { getSelectedDOMElement } from "@/lib/tiptap-advanced-utils"
import {
  findPrioritizedAIElement,
  cleanupFallbackAnchors,
  getSelectionRangeRect,
  createVirtualAnchor,
  createEditorWidthAnchorRect,
} from "@/components/tiptap-ui/ai-menu/ai-menu-utils"
import type {
  AiMenuState,
  AiMenuStateContextValue,
} from "@/components/tiptap-ui/ai-menu/ai-menu-types"

/** Safely remove an element ref and nullify it. */
function cleanupRef(ref: React.MutableRefObject<HTMLElement | null>) {
  if (ref.current) {
    ref.current.remove()
    ref.current = null
  }
}

export const AiMenuStateContext = createContext<AiMenuStateContextValue | null>(
  null
)

export const initialState: AiMenuState = {
  isOpen: false,
  tone: undefined,
  language: "en",
  shouldShowInput: true,
  inputIsFocused: false,
  fallbackAnchor: { element: null, rect: null },
}

export function useAiMenuState() {
  const context = useContext(AiMenuStateContext)

  if (!context) {
    throw new Error("useAiMenuState must be used within an AiMenuStateProvider")
  }

  return context
}

export function useAiMenuStateProvider() {
  const [state, setState] = useState<AiMenuState>(initialState)

  const updateState = useCallback((updates: Partial<AiMenuState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  const setFallbackAnchor = useCallback(
    (element: HTMLElement | null, rect?: DOMRect | null) => {
      updateState({
        fallbackAnchor: {
          element,
          rect: rect || element?.getBoundingClientRect() || null,
        },
      })
    },
    [updateState]
  )

  const reset = useCallback(() => {
    setState(initialState)
    cleanupFallbackAnchors()
  }, [])

  const value = useMemo(
    () => ({ state, updateState, setFallbackAnchor, reset }),
    [state, updateState, setFallbackAnchor, reset]
  )

  return { value, AiMenuStateContext }
}

// ─── Content Tracker ─────────────────────────────────────────────────

function getLastAiElement(editorDom: HTMLElement): HTMLElement | null {
  const elements = editorDom.querySelectorAll(
    ".tiptap-ai-insertion"
  ) as NodeListOf<HTMLElement>
  return elements[elements.length - 1] ?? null
}

function isAiLoading(editor: Editor): boolean {
  const aiStorage = editor.storage.ai || editor.storage.aiAdvanced
  return aiStorage?.state === "loading"
}

export function useAiContentTracker({
  editor,
  aiGenerationActive,
  setAnchorElement,
  anchorToSelection = false,
}: {
  editor: Editor | null
  aiGenerationActive: boolean
  setAnchorElement: (element: HTMLElement) => void
  anchorToSelection?: boolean
}) {
  const fallbackAnchorRef = useRef<HTMLElement | null>(null)
  const streamingAnchorRef = useRef<HTMLElement | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor || !aiGenerationActive) return

    const cleanupStreamingAnchor = () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      cleanupRef(streamingAnchorRef)
    }

    const updateStreamingAnchor = (aiElement: HTMLElement) => {
      const anchorRect = createEditorWidthAnchorRect(
        editor.view.dom,
        aiElement.getBoundingClientRect()
      )

      if (streamingAnchorRef.current) {
        streamingAnchorRef.current.remove()
      }

      streamingAnchorRef.current = createVirtualAnchor(
        anchorRect,
        editor.view.dom
      )
      setAnchorElement(streamingAnchorRef.current)
    }

    const scheduleStreamingUpdate = (aiElement: HTMLElement) => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() =>
        updateStreamingAnchor(aiElement)
      )
    }

    const handleStreamingMode = () => {
      const lastAiElement = getLastAiElement(editor.view.dom)
      if (!lastAiElement) return

      scheduleStreamingUpdate(lastAiElement)

      if (!resizeObserverRef.current) {
        resizeObserverRef.current = new ResizeObserver(() =>
          scheduleStreamingUpdate(lastAiElement)
        )
        resizeObserverRef.current.observe(lastAiElement)
      }
    }

    const handleStaticMode = () => {
      let targetElement: HTMLElement | null = null

      if (anchorToSelection) {
        targetElement = getLastAiElement(editor.view.dom)
      }

      if (!targetElement) {
        const aiMarkedElement = findPrioritizedAIElement(editor)
        if (aiMarkedElement && aiMarkedElement !== editor.view.dom) {
          targetElement = aiMarkedElement
        }
      }

      if (!targetElement) return

      cleanupRef(fallbackAnchorRef)

      const anchorRect = createEditorWidthAnchorRect(
        editor.view.dom,
        targetElement.getBoundingClientRect()
      )
      const anchor = createVirtualAnchor(anchorRect, editor.view.dom)
      fallbackAnchorRef.current = anchor

      setAnchorElement(anchor)
    }

    const handleTransaction = ({ editor }: { editor: Editor }) => {
      if (isAiLoading(editor) && anchorToSelection) {
        handleStreamingMode()
      } else {
        cleanupStreamingAnchor()
        handleStaticMode()
      }
    }

    editor.on("transaction", handleTransaction)

    return () => {
      editor.off("transaction", handleTransaction)
      cleanupStreamingAnchor()
      cleanupRef(fallbackAnchorRef)
    }
  }, [aiGenerationActive, anchorToSelection, editor, setAnchorElement])
}

// ─── Text Selection Tracker ──────────────────────────────────────────

export function useTextSelectionTracker({
  editor,
  aiGenerationActive,
  showMenuAtElement,
  setMenuVisible,
  onSelectionChange,
  prevent = false,
  anchorToSelection = false,
}: {
  editor: Editor | null
  aiGenerationActive: boolean
  showMenuAtElement: (element: HTMLElement) => void
  setMenuVisible: (visible: boolean) => void
  onSelectionChange?: (
    element: HTMLElement | null,
    rect: DOMRect | null
  ) => void
  prevent?: boolean
  anchorToSelection?: boolean
}) {
  const selectionAnchorRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!editor || !aiGenerationActive || prevent) return

    const showAtAnchor = (anchor: HTMLElement, rect: DOMRect) => {
      setMenuVisible(true)
      onSelectionChange?.(anchor, rect)
      showMenuAtElement(anchor)
    }

    const handleSelectionAnchored = (editor: Editor) => {
      const selectionRect = getSelectionRangeRect(editor)
      if (!selectionRect) return false

      const anchorRect = createEditorWidthAnchorRect(
        editor.view.dom,
        selectionRect
      )

      cleanupRef(selectionAnchorRef)

      const anchor = createVirtualAnchor(anchorRect, editor.view.dom)
      selectionAnchorRef.current = anchor

      showAtAnchor(anchor, anchorRect)
      return true
    }

    const handleSelectionDefault = (editor: Editor) => {
      const selectedElement = getSelectedDOMElement(editor)
      const shouldShow = Boolean(selectedElement && aiGenerationActive)

      setMenuVisible(shouldShow)

      if (shouldShow && selectedElement) {
        showAtAnchor(selectedElement, selectedElement.getBoundingClientRect())
      }
    }

    const handleTransaction = ({
      editor,
      transaction,
    }: {
      editor: Editor
      transaction: Transaction
    }) => {
      if (transaction.selection?.empty) return

      if (anchorToSelection && handleSelectionAnchored(editor)) return

      handleSelectionDefault(editor)
    }

    editor.on("transaction", handleTransaction)

    return () => {
      editor.off("transaction", handleTransaction)
      cleanupRef(selectionAnchorRef)
    }
  }, [
    editor,
    aiGenerationActive,
    showMenuAtElement,
    setMenuVisible,
    onSelectionChange,
    prevent,
    anchorToSelection,
  ])
}
