import type { Participant } from "../../../shared";

type PresenceBarProps = {
  participants: Participant[];
};

/** Shows who currently has this board open without announcing cursor movement. */
export function PresenceBar({ participants }: PresenceBarProps) {
  if (participants.length === 0) return null;

  return (
    <div
      className="presence-bar"
      aria-label={`${participants.length} ${participants.length === 1 ? "person" : "people"} online`}
    >
      <div className="presence-avatars" aria-hidden="true">
        {participants.slice(0, 4).map((participant) => (
          <span
            className="presence-avatar"
            key={participant.clientId}
            style={{ backgroundColor: participant.color }}
            title={participant.displayName}
          >
            {participant.displayName.slice(-4, -2)}
          </span>
        ))}
      </div>
      <span>{participants.length} online</span>
    </div>
  );
}
