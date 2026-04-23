import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import Tile from './Tile'
import type { Session, FsAccess } from '../types'

interface Props {
  sessions: Session[]
  streamingContents: Record<string, string>
  activeTileIndex: number
  selectedIds: Set<string>
  activeInputValue: string
  expandHotkey: string
  layout: 'wide' | 'tall'
  onSendMessage: (sessionId: string, text: string) => void
  onRemove: (sessionId: string) => void
  onRename: (sessionId: string, name: string) => void
  onReorder: (sessions: Session[]) => void
  onFocusTile: (index: number) => void
  onActiveInputChange: (value: string) => void
  onFsAccessChange: (sessionId: string, level: FsAccess) => void
  onAgentInteropChange: (sessionId: string, value: boolean | null) => void
  defaultAgentInteropEnabled: boolean
}

export default function TileGrid({ sessions, streamingContents, activeTileIndex, selectedIds, activeInputValue, expandHotkey, layout, onSendMessage, onRemove, onRename, onReorder, onFocusTile, onActiveInputChange, onFsAccessChange, onAgentInteropChange, defaultAgentInteropEnabled }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sessions.findIndex(s => s.id === active.id)
      const newIndex = sessions.findIndex(s => s.id === over.id)
      onReorder(arrayMove(sessions, oldIndex, newIndex))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sessions.map(s => s.id)} strategy={rectSortingStrategy}>
        <div className={`tile-grid${layout === 'tall' ? ' tile-grid--tall' : ''}`}>
          {sessions.map((session, i) => (
            <Tile
              key={session.id}
              session={session}
              streamingContent={streamingContents[session.id] ?? ''}
              isActive={i === activeTileIndex}
              isSelected={selectedIds.has(session.id) || (selectedIds.size > 0 && i === activeTileIndex)}
              activeInputValue={i === activeTileIndex ? activeInputValue : null}
              mirroredInputValue={i !== activeTileIndex && selectedIds.has(session.id) ? activeInputValue : null}
              expandHotkey={expandHotkey}
              onSendMessage={onSendMessage}
              onRemove={onRemove}
              onRename={onRename}
              onFocus={() => onFocusTile(i)}
              onActiveInputChange={onActiveInputChange}
              onFsAccessChange={onFsAccessChange}
              onAgentInteropChange={onAgentInteropChange}
              defaultAgentInteropEnabled={defaultAgentInteropEnabled}
              unread={session.unread}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
