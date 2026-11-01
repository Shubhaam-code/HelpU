import { cn } from '../../lib/utils';

export function ChatBubble({ message, isMe, timestamp, type = 'text' }) {
  if (type === 'location') {
    return (
      <div className={cn('flex gap-2 mb-3', isMe ? 'flex-row-reverse' : 'flex-row')}>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 max-w-[240px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📍</span>
            <div>
              <div className="font-semibold text-navy text-sm">{message.title || 'Location'}</div>
              <div className="text-xs text-coral">{message.subtitle || 'Open in Maps'}</div>
            </div>
            <span className="ml-auto text-text-secondary">→</span>
          </div>
          {message.mapPreview && (
            <div className="mt-1 rounded-xl overflow-hidden h-16 bg-mint flex items-center justify-center text-xs text-text-secondary">
              📍 Map Preview
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 mb-3', isMe ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
          isMe
            ? 'bg-navy text-white rounded-tr-sm'
            : 'bg-white text-navy shadow-sm border border-gray-100 rounded-tl-sm'
        )}
      >
        {message.text || message}
      </div>
      {timestamp && (
        <div className="self-end text-[10px] text-text-secondary pb-1">{timestamp}</div>
      )}
    </div>
  );
}

export default ChatBubble;
