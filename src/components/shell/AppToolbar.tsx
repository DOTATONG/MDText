import { ChevronDown, Download, Eye, FolderOpen, FolderSearch, PencilLine, Settings, SplitSquareHorizontal } from 'lucide-react'
import type { MouseEvent, RefObject } from 'react'
import type { RecentFile } from '../../domain/recentFiles'
import type { AppMenuId } from '../../hooks/useAppMenu'
import type { AppLanguage, Translation } from '../../i18n'
import type { AppUpdatePhase } from '../../hooks/useAppUpdater'
import type { AppShortcutHints, ShortcutHint } from '../../platform/appShortcuts'
import type { AppWindowFrame } from '../../platform/windowFrame'
import { AppLogo } from './AppLogo'
import { WindowControls } from './WindowControls'

type ViewMode = 'preview' | 'edit' | 'split'

export type AppToolbarZoom = {
  /** Section label including the current percentage. */
  label: string
  resetDisabled: boolean
  resetTitle: string
  zoomInDisabled: boolean
  zoomInTitle: string
  zoomOutDisabled: boolean
  zoomOutTitle: string
  onReset: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

export function AppToolbar({
  activeMenu, canRevealFiles, documentPath, documentTitle, isSaving, isWelcomeVisible,
  language, menuBarRef, nativeFileTitle, recentFiles, shortcuts, supportsAppUpdates, t, updatePhase,
  updateActionTitle, viewMode, closeFileTitle, newTitle, openTitle, saveTitle, saveAsTitle,
  windowFrame, zoom,
  onAbout, onCheckUpdates, onClearRecent, onCloseDocument, onExportDocx, onExportHtml, onExportPdf,
  onImportDocx, onLanguage, onNew, onOpen, onOpenRecent, onOpenReadingSettings, onReveal,
  onSave, onSaveAs, onToggleMenu, onViewMode,
}: {
  activeMenu: AppMenuId | null
  canRevealFiles: boolean
  documentPath: string | null
  documentTitle: string
  isSaving: boolean
  isWelcomeVisible: boolean
  language: AppLanguage
  menuBarRef: RefObject<HTMLElement | null>
  nativeFileTitle?: string
  recentFiles: RecentFile[]
  shortcuts: AppShortcutHints
  supportsAppUpdates: boolean
  t: Translation
  updatePhase: AppUpdatePhase
  updateActionTitle?: string
  viewMode: ViewMode
  windowFrame: AppWindowFrame
  zoom: AppToolbarZoom
  closeFileTitle: string
  newTitle: string
  openTitle: string
  saveTitle: string
  saveAsTitle: string
  onAbout: () => void
  onCheckUpdates: () => void
  onClearRecent: () => void
  onCloseDocument: () => void
  onExportDocx: () => void
  onExportHtml: () => void
  onExportPdf: () => void
  onImportDocx?: () => void
  onLanguage: (language: AppLanguage) => void
  onNew: () => void
  onOpen: () => void
  onOpenRecent: (path: string) => void
  onOpenReadingSettings: () => void
  onReveal: (path: string) => void
  onSave: () => void
  onSaveAs: () => void
  onToggleMenu: (menu: AppMenuId) => void
  onViewMode: (mode: ViewMode) => void
}) {
  const nativeFilesEnabled = nativeFileTitle === undefined
  const handleTitlebarMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (windowFrame.kind === 'native' || event.button !== 0) return
    if ((event.target as HTMLElement).closest(
      '[data-window-interactive="true"], button, a, input, select, textarea, [role="menu"]',
    )) return

    const action = event.detail === 2
      ? windowFrame.toggleMaximize
      : windowFrame.startDragging
    void action().catch(() => undefined)
  }

  return <header
    className={`topbar window-frame-${windowFrame.kind}`}
    onMouseDown={handleTitlebarMouseDown}
  >
    <div className="brand-block">
      <div className="app-mark" aria-hidden="true"><AppLogo /></div>
      <div className="brand-text"><h1>MDText</h1><p title={isWelcomeVisible ? t.welcomeBrand : documentPath ?? documentTitle}>{isWelcomeVisible ? t.welcomeBrand : documentTitle}</p></div>
    </div>
    <nav className="toolbar" aria-label={t.documentActions} ref={menuBarRef}>
      <div className="action-menu">
        <button type="button" onClick={() => onToggleMenu('file')} aria-haspopup="menu" aria-expanded={activeMenu === 'file'}>
          <FolderOpen aria-hidden="true" /><span>{t.fileMenu}</span><ChevronDown aria-hidden="true" />
        </button>
        {activeMenu === 'file' ? <div className="action-menu-panel" role="menu">
          <button type="button" className="action-menu-item" onClick={onNew} title={newTitle} aria-keyshortcuts={shortcuts.new.aria} role="menuitem">{t.createNew}<MenuShortcut hint={shortcuts.new} /></button>
          <button type="button" className="action-menu-item" onClick={onOpen} disabled={!nativeFilesEnabled} title={nativeFileTitle ?? openTitle} aria-keyshortcuts={shortcuts.open.aria} role="menuitem">{t.openMarkdownFile}<MenuShortcut hint={shortcuts.open} /></button>
          {onImportDocx ? <button type="button" className="action-menu-item" onClick={onImportDocx} disabled={!nativeFilesEnabled} title={nativeFileTitle} role="menuitem">{t.importDocx}</button> : null}
          <button type="button" className="action-menu-item" onClick={onSave} disabled={isWelcomeVisible || !nativeFilesEnabled || isSaving} title={nativeFileTitle ?? saveTitle} aria-keyshortcuts={shortcuts.save.aria} role="menuitem">{t.save}<MenuShortcut hint={shortcuts.save} /></button>
          <button type="button" className="action-menu-item" onClick={onSaveAs} disabled={isWelcomeVisible || !nativeFilesEnabled || isSaving} title={nativeFileTitle ?? saveAsTitle} aria-keyshortcuts={shortcuts.saveAs.aria} role="menuitem">{t.saveAs}<MenuShortcut hint={shortcuts.saveAs} /></button>
          <button type="button" className="action-menu-item" onClick={onCloseDocument} disabled={isWelcomeVisible} title={closeFileTitle} aria-keyshortcuts={shortcuts.close.aria} role="menuitem">{t.closeFile}<MenuShortcut hint={shortcuts.close} /></button>
          <div className="action-menu-divider" /><div className="action-menu-section-label">{t.recentFiles}</div>
          {recentFiles.length > 0 ? recentFiles.map((file) => <div className="recent-file-menu-row" key={file.path}>
            <button type="button" className="action-menu-item recent-file-item" onClick={() => onOpenRecent(file.path)} disabled={!nativeFilesEnabled} title={file.path} role="menuitem"><span className="recent-file-title">{file.title}</span></button>
            {canRevealFiles ? <button type="button" className="recent-file-reveal" onClick={() => onReveal(file.path)} title={t.reveal} aria-label={t.revealInFolder(file.title)} role="menuitem"><FolderSearch aria-hidden="true" /></button> : null}
          </div>) : <div className="action-menu-empty">{t.noRecentFiles}</div>}
          <button type="button" className="action-menu-item action-menu-clear" onClick={onClearRecent} disabled={recentFiles.length === 0} role="menuitem">{t.clearRecentFiles}</button>
        </div> : null}
      </div>
      {!isWelcomeVisible ? <div className="action-menu">
        <button type="button" onClick={() => onToggleMenu('export')} aria-haspopup="menu" aria-expanded={activeMenu === 'export'} disabled={!nativeFilesEnabled} title={nativeFileTitle}><Download aria-hidden="true" /><span>{t.exportMenu}</span><ChevronDown aria-hidden="true" /></button>
        {activeMenu === 'export' && nativeFilesEnabled ? <div className="action-menu-panel action-menu-panel-compact" role="menu">
          <button type="button" className="action-menu-item" onClick={onExportHtml} role="menuitem">{t.exportAsHtml}</button>
          <button type="button" className="action-menu-item" onClick={onExportPdf} role="menuitem">{t.exportAsPdf}</button>
          <button type="button" className="action-menu-item" onClick={onExportDocx} role="menuitem">{t.exportAsDocx}</button>
        </div> : null}
      </div> : null}
      <div className="action-menu">
        <button type="button" onClick={() => onToggleMenu('app')} aria-haspopup="menu" aria-expanded={activeMenu === 'app'}><Settings aria-hidden="true" /><span>{t.appMenu}</span><ChevronDown aria-hidden="true" /></button>
        {activeMenu === 'app' ? <div className="action-menu-panel action-menu-panel-compact" role="menu">
          <div className="action-menu-section-label">{t.languageLabel}</div>
          <button type="button" className={`action-menu-item ${language === 'en' ? 'active' : ''}`} onClick={() => onLanguage('en')} role="menuitem">{t.languageEnglish}</button>
          <button type="button" className={`action-menu-item ${language === 'zh' ? 'active' : ''}`} onClick={() => onLanguage('zh')} role="menuitem">{t.languageChinese}</button>
          <div className="action-menu-section-label">{zoom.label}</div>
          <button type="button" className="action-menu-item" onClick={zoom.onZoomIn} disabled={zoom.zoomInDisabled} title={zoom.zoomInTitle} aria-keyshortcuts={shortcuts.zoomIn.aria} role="menuitem">{t.uiZoomIn}<MenuShortcut hint={shortcuts.zoomIn} /></button>
          <button type="button" className="action-menu-item" onClick={zoom.onZoomOut} disabled={zoom.zoomOutDisabled} title={zoom.zoomOutTitle} aria-keyshortcuts={shortcuts.zoomOut.aria} role="menuitem">{t.uiZoomOut}<MenuShortcut hint={shortcuts.zoomOut} /></button>
          <button type="button" className="action-menu-item" onClick={zoom.onReset} disabled={zoom.resetDisabled} title={zoom.resetTitle} aria-keyshortcuts={shortcuts.zoomReset.aria} role="menuitem">{t.uiZoomReset}<MenuShortcut hint={shortcuts.zoomReset} /></button>
          <div className="action-menu-divider" />
          <button type="button" className="action-menu-item" onClick={onOpenReadingSettings} role="menuitem">{t.readingSettings}</button>
          {supportsAppUpdates ? <button type="button" className="action-menu-item" onClick={onCheckUpdates} disabled={updateActionTitle !== undefined || updatePhase === 'checking'} title={updateActionTitle} role="menuitem">{updatePhase === 'checking' ? t.updateChecking : t.checkForUpdates}</button> : null}
          <button type="button" className="action-menu-item" onClick={onAbout} role="menuitem">{t.about}</button>
        </div> : null}
      </div>
    </nav>
    {!isWelcomeVisible ? <div className="view-controls" role="group" aria-label={t.viewMode} data-window-interactive="true">
      <button type="button" className={viewMode === 'preview' ? 'active' : ''} onClick={() => onViewMode('preview')} aria-label={t.previewLabel}><Eye aria-hidden="true" /><span>{t.preview}</span></button>
      <button type="button" className={viewMode === 'edit' ? 'active' : ''} onClick={() => onViewMode('edit')} aria-label={t.editLabel}><PencilLine aria-hidden="true" /><span>{t.edit}</span></button>
      <button type="button" className={viewMode === 'split' ? 'active' : ''} onClick={() => onViewMode('split')} aria-label={t.splitLabel}><SplitSquareHorizontal aria-hidden="true" /><span>{t.split}</span></button>
    </div> : null}
    {windowFrame.kind === 'windows-custom' ? <WindowControls
      frame={windowFrame}
      labels={{
        close: t.windowClose,
        maximize: t.windowMaximize,
        minimize: t.windowMinimize,
        restore: t.windowRestore,
      }}
    /> : null}
  </header>
}

/**
 * Visual hint at the trailing edge of a menu item. Hidden from assistive
 * technology because the menu item already exposes `aria-keyshortcuts`.
 */
function MenuShortcut({ hint }: { hint: ShortcutHint }) {
  return <span className="action-menu-shortcut" aria-hidden="true">{hint.label}</span>
}
