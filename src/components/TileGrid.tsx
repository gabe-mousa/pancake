import { useState, useCallback } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'
import { SortableContext, arrayMove } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import Tile from './Tile'
import type { Session, SessionGroup, FsAccess, Hotkeys } from '../types'

interface Props {
  sessions: Session[]
  streamingContents: Record<string, string>
  activeTileIndex: number
  selectedIds: Set<string>
  activeInputValue: string
  expandHotkey: string
  layout: 'wide' | 'tall'
  hotkeys: Hotkeys
  groups: SessionGroup[]
  pageVisible: boolean
  onSendMessage: (sessionId: string, text: string) => void
  onRemove: (sessionId: string) => void
  onRename: (sessionId: string, name: string) => void
  onReorder: (sessions: Session[]) => void
  onFocusTile: (index: number) => void
  onActiveInputChange: (value: string) => void
  onFsAccessChange: (sessionId: string, level: FsAccess) => void
  onAgentInteropChange: (sessionId: string, value: boolean | null) => void
  onCcCwdChange?: (sessionId: string, cwd: string) => void
  onAddGroup: (name: string) => void
  onRemoveGroup: (groupId: string) => void
  onToggleGroupCollapsed: (groupId: string) => void
  onSetSessionGroup: (sessionId: string, groupId: string | undefined) => void
  defaultAgentInteropEnabled: boolean
}

/** Drop target wrapper for group areas */
function DroppableGroupArea({ groupId, children, className }: { groupId: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${groupId}` })
  return (
    <div ref={setNodeRef} className={`${className || ''}${isOver ? ' group-area-drop-active' : ''}`}>
      {children}
    </div>
  )
}

export default function TileGrid({ sessions, streamingContents, activeTileIndex, selectedIds, activeInputValue, expandHotkey, layout, hotkeys, groups, pageVisible, onSendMessage, onRemove, onRename, onReorder, onFocusTile, onActiveInputChange, onFsAccessChange, onAgentInteropChange, onCcCwdChange, onAddGroup, onRemoveGroup, onToggleGroupCollapsed, onSetSessionGroup, defaultAgentInteropEnabled }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)

  // Custom collision detection: prefer pointerWithin (what the cursor is inside),
  // fall back to rectIntersection for edge cases
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    return rectIntersection(args)
  }, [])

  function handleDragStart(event: DragStartEvent) {
    setDragActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragActiveId(null)
    const { active, over } = event
    if (!over) return

    const overId = String(over.id)

    // Dropping onto a group area drop zone
    if (overId.startsWith('group:')) {
      const groupId = overId.replace('group:', '')
      const targetGroup = groupId === 'ungrouped' ? undefined : groupId
      const session = sessions.find(s => s.id === active.id)
      if (session && session.groupId !== targetGroup) {
        onSetSessionGroup(String(active.id), targetGroup)
      }
      return
    }

    // Dropping onto another session tile
    if (active.id !== over.id) {
      const oldIndex = sessions.findIndex(s => s.id === active.id)
      const newIndex = sessions.findIndex(s => s.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const targetSession = sessions[newIndex]
        const sourceSession = sessions[oldIndex]
        const changingGroup = targetSession && sourceSession && targetSession.groupId !== sourceSession.groupId
        if (changingGroup) {
          onSetSessionGroup(String(active.id), targetSession.groupId)
        } else {
          onReorder(arrayMove(sessions, oldIndex, newIndex))
        }
      }
    }
  }

  function handleDragCancel() {
    setDragActiveId(null)
  }

  function renderTile(session: Session) {
    const i = sessions.indexOf(session)
    return (
      <Tile
        key={session.id}
        session={session}
        streamingContent={streamingContents[session.id] ?? ''}
        isActive={i === activeTileIndex}
        isSelected={selectedIds.has(session.id) || (selectedIds.size > 0 && i === activeTileIndex)}
        activeInputValue={i === activeTileIndex ? activeInputValue : null}
        mirroredInputValue={i !== activeTileIndex && selectedIds.has(session.id) ? activeInputValue : null}
        expandHotkey={expandHotkey}
        hotkeys={hotkeys}
        onSendMessage={onSendMessage}
        onRemove={onRemove}
        onRename={onRename}
        onFocus={() => onFocusTile(i)}
        onActiveInputChange={onActiveInputChange}
        onFsAccessChange={onFsAccessChange}
        onAgentInteropChange={onAgentInteropChange}
        onCcCwdChange={onCcCwdChange}
        pageVisible={pageVisible}
        defaultAgentInteropEnabled={defaultAgentInteropEnabled}
        unread={session.unread}
      />
    )
  }

  function commitNewGroup() {
    const trimmed = newGroupName.trim()
    if (trimmed) onAddGroup(trimmed)
    setNewGroupName('')
    setShowNewGroup(false)
  }

  const gridClass = `tile-grid${layout === 'tall' ? ' tile-grid--tall' : ''}`
  const hasGroups = groups.length > 0
  const ungroupedSessions = sessions.filter(s => !s.groupId || !groups.find(g => g.id === s.groupId))
  const groupedSets = groups.map(g => ({
    group: g,
    sessions: sessions.filter(s => s.groupId === g.id),
  }))

  const dragSession = dragActiveId ? sessions.find(s => s.id === dragActiveId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Single SortableContext with ALL sessions for smooth cross-group DnD */}
      <SortableContext items={sessions.map(s => s.id)}>
        <div className="tile-grid-container">
          {/* Group toolbar */}
          <div className="group-toolbar">
            {showNewGroup ? (
              <span className="group-new-inline">
                <input
                  className="group-name-input"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitNewGroup(); if (e.key === 'Escape') { setShowNewGroup(false); setNewGroupName('') } }}
                  onBlur={() => { if (!newGroupName.trim()) setShowNewGroup(false) }}
                  placeholder="Group name..."
                  autoFocus
                />
                <button className="group-new-confirm" onClick={commitNewGroup}>+</button>
              </span>
            ) : (
              <button className="group-add-btn" onClick={() => setShowNewGroup(true)} title="Create a session group">
                + New Group
              </button>
            )}
          </div>

          {hasGroups ? (
            <>
              {groupedSets.map(({ group, sessions: groupSessions }) => (
                <DroppableGroupArea key={group.id} groupId={group.id} className="session-group">
                  <div className="session-group-header">
                    <button className="session-group-toggle" onClick={() => onToggleGroupCollapsed(group.id)}>
                      {group.collapsed ? '▸' : '▾'}
                    </button>
                    <span className="session-group-name">{group.name}</span>
                    <button
                      className="session-group-rm"
                      onClick={e => { e.stopPropagation(); onRemoveGroup(group.id) }}
                      title="Remove group"
                    >×</button>
                  </div>
                  {!group.collapsed && (
                    <div className={gridClass}>
                      {groupSessions.map(session => renderTile(session))}
                      {groupSessions.length === 0 && (
                        <div className="group-empty">Drop sessions here</div>
                      )}
                    </div>
                  )}
                </DroppableGroupArea>
              ))}
              {/* Ungrouped */}
              {ungroupedSessions.length > 0 && (
                <DroppableGroupArea groupId="ungrouped" className="session-group session-group-ungrouped">
                  <div className="session-group-header">
                    <span className="session-group-name session-group-name-ungrouped">Ungrouped</span>
                  </div>
                  <div className={gridClass}>
                    {ungroupedSessions.map(session => renderTile(session))}
                  </div>
                </DroppableGroupArea>
              )}
            </>
          ) : (
            <div className={gridClass}>
              {sessions.map(session => renderTile(session))}
            </div>
          )}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {dragSession ? (
          <div className="tile tile-drag-overlay">
            <div className="tile-header">
              <span className="tile-name">{dragSession.name}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
