import { useState } from 'react';
import './NotificationsView.css';

export type NotificationType =
  | 'appointment'
  | 'reminder'
  | 'system'
  | 'success';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  unread: boolean;
};

type NotificationsViewProps = {
  notifications: Notification[];
  // All three of these are backed by real writes to the `notifications`
  // table in Supabase (see Dashboard.tsx) — this component only owns the
  // transient "which rows are selected" UI state below.
  onMarkAllRead: () => void;
  onMarkSelectedRead: (ids: string[]) => void;
  onDeleteSelected: (ids: string[]) => void;
};

export default function NotificationsView({
  notifications,
  onMarkAllRead,
  onMarkSelectedRead,
  onDeleteSelected,
}: NotificationsViewProps) {
  // Selection mode is OFF by default
  const [selectionMode, setSelectionMode] = useState(false);

  // IDs of selected notifications
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allSelected =
    notifications.length > 0 &&
    selectedIds.length === notifications.length;

  const unreadCount = notifications.filter(
    (notification) => notification.unread
  ).length;

  // Enter selection mode
  const handleSelect = () => {
    setSelectionMode(true);
    setSelectedIds([]);
  };

  // Exit selection mode
  const handleCancel = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  // Select / unselect one notification
  const toggleNotification = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(
        notifications.map((notification) => notification.id)
      );
    }
  };

  // Delete selected notifications — actually deletes the rows in Supabase.
  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    onDeleteSelected(selectedIds);
    setSelectedIds([]);
    setSelectionMode(false);
  };

  // Mark all as read — updates every unread row for this faculty member.
  const markAllAsRead = () => {
    onMarkAllRead();
  };

  // Mark selected notifications as read.
  const markSelectedAsRead = () => {
    if (selectedIds.length === 0) return;
    onMarkSelectedRead(selectedIds);
    setSelectedIds([]);
    setSelectionMode(false);
  };

  return (
    <section
      className="nv-page"
      aria-labelledby="notifications-heading"
    >
      <div className="nv-notifications-card">

        {/* HEADER */}
        <div className="nv-header">
          <div>
            <h1 id="notifications-heading">
              Notifications
            </h1>

            <p>
              {unreadCount > 0
                ? `${unreadCount} unread notifications`
                : "You're all caught up"}
            </p>
          </div>

          {!selectionMode ? (
            <div className="nv-header-actions">

              {/* SELECT BUTTON */}
              <button
                type="button"
                className="nv-action-button"
                onClick={handleSelect}
              >
                Select
              </button>

              {/* MARK ALL AS READ */}
              <button
                type="button"
                className="nv-action-button"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>

            </div>
          ) : (
            <div className="nv-header-actions">

              {/* CANCEL */}
              <button
                type="button"
                className="nv-cancel-button"
                onClick={handleCancel}
              >
                Cancel
              </button>

              {/* MARK SELECTED AS READ */}
              <button
                type="button"
                className="nv-action-button"
                disabled={selectedIds.length === 0}
                onClick={markSelectedAsRead}
              >
                Mark as read
              </button>

              {/* DELETE */}
              <button
                type="button"
                className="nv-delete-button"
                disabled={selectedIds.length === 0}
                onClick={handleDelete}
              >
                Delete
              </button>

            </div>
          )}
        </div>

        {/* SELECTION TOOLBAR */}
        {selectionMode && (
          <div className="nv-select-toolbar">

            <label className="nv-select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                aria-label="Select all notifications"
              />

              <span>
                {allSelected
                  ? 'Deselect all'
                  : 'Select all'}
              </span>
            </label>

            <span className="nv-selected-count">
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : '0 selected'}
            </span>

          </div>
        )}

        {/* NOTIFICATIONS */}
        <div className="nv-notification-list">

          {notifications.length === 0 ? (
            <div className="nv-empty-state">
              <div className="nv-empty-icon">
                ✓
              </div>

              <h2>No notifications</h2>

              <p>
                You're all caught up.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <article
                key={notification.id}
                className={`nv-notification${
                  notification.unread
                    ? ' nv-notification-unread'
                    : ''
                }${
                  selectedIds.includes(notification.id)
                    ? ' nv-notification-selected'
                    : ''
                }`}
              >

                {/* CHECKBOX ONLY SHOWS IN SELECT MODE */}
                {selectionMode && (
                  <div className="nv-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(
                        notification.id
                      )}
                      onChange={() =>
                        toggleNotification(notification.id)
                      }
                      aria-label={`Select ${notification.title}`}
                    />
                  </div>
                )}

                {/* ICON */}
                <span
                  className="nv-notification-icon"
                  aria-hidden="true"
                >
                  <NotificationIcon
                    type={notification.type}
                  />
                </span>

                {/* CONTENT */}
                <div className="nv-notification-copy">
                  <h2>{notification.title}</h2>

                  <p>{notification.message}</p>
                </div>

                {/* TIME */}
                <time>{notification.time}</time>

              </article>
            ))
          )}

        </div>
      </div>
    </section>
  );
}

function NotificationIcon({
  type,
}: {
  type: NotificationType;
}) {
  if (type === 'appointment') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="17"
          rx="2"
        />

        <line
          x1="16"
          y1="2"
          x2="16"
          y2="6"
        />

        <line
          x1="8"
          y1="2"
          x2="8"
          y2="6"
        />

        <line
          x1="3"
          y1="10"
          x2="21"
          y2="10"
        />
      </svg>
    );
  }

  if (type === 'reminder') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    );
  }

  if (type === 'success') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <line
        x1="12"
        y1="11"
        x2="12"
        y2="16"
      />

      <line
        x1="12"
        y1="8"
        x2="12.01"
        y2="8"
      />
    </svg>
  );
}