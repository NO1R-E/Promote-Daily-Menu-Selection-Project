type RoomsListener = (roomId?: string | null) => void;
type DeletedListener = (roomId: string) => void;

const roomListeners = new Set<RoomsListener>();
const deletedListeners = new Set<DeletedListener>();

export function onRoomsChanged(fn: RoomsListener) {
  roomListeners.add(fn);
  return () => {
    roomListeners.delete(fn);
  };
}

export function emitRoomsChanged(roomId?: string | null) {
  roomListeners.forEach((fn) => fn(roomId));
}

export function onRoomDeleted(fn: DeletedListener) {
  deletedListeners.add(fn);
  return () => {
    deletedListeners.delete(fn);
  };
}

export function emitRoomDeleted(roomId: string) {
  deletedListeners.forEach((fn) => fn(roomId));
}