type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

export interface SimplifiedBookmark {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  parentId?: string;
}

const isExtensionRuntime = () => typeof chrome !== "undefined" && !!chrome.bookmarks;

export async function fetchBookmarkTree(): Promise<SimplifiedBookmark[]> {
  if (!isExtensionRuntime()) {
    throw new Error("Chrome bookmarks API is not available in this environment.");
  }

  const nodes = await chrome.bookmarks.getTree();
  const results: SimplifiedBookmark[] = [];

  const traverse = (treeNodes: BookmarkTreeNode[]) => {
    for (const node of treeNodes) {
      results.push({
        id: node.id,
        title: node.title,
        url: node.url ?? undefined,
        dateAdded: node.dateAdded,
        parentId: node.parentId
      });
      if (node.children?.length) {
        traverse(node.children);
      }
    }
  };

  traverse(nodes);
  return results;
}

type BookmarkEvent = {
  type: "created" | "changed" | "removed";
  payload: unknown;
};

export function subscribeToBookmarkEvents(callback: (event: BookmarkEvent) => void) {
  if (!isExtensionRuntime()) return () => undefined;

  const createdListener: Parameters<typeof chrome.bookmarks.onCreated.addListener>[0] = (id, node) =>
    callback({ type: "created", payload: { id, node } });

  const changedListener: Parameters<typeof chrome.bookmarks.onChanged.addListener>[0] = (id, changeInfo) =>
    callback({ type: "changed", payload: { id, changeInfo } });

  const removedListener: Parameters<typeof chrome.bookmarks.onRemoved.addListener>[0] = (id, removeInfo) =>
    callback({ type: "removed", payload: { id, removeInfo } });

  chrome.bookmarks.onCreated.addListener(createdListener);
  chrome.bookmarks.onChanged.addListener(changedListener);
  chrome.bookmarks.onRemoved.addListener(removedListener);

  return () => {
    chrome.bookmarks.onCreated.removeListener(createdListener);
    chrome.bookmarks.onChanged.removeListener(changedListener);
    chrome.bookmarks.onRemoved.removeListener(removedListener);
  };
}

