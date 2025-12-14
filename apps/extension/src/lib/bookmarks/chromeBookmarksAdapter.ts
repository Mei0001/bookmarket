type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

export interface SimplifiedBookmark {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  parentId?: string;
}

export interface ChromeUrlBookmark {
  id: string;
  title: string;
  url: string;
  dateAdded?: number;
  parentId?: string;
}

const isExtensionRuntime = () => typeof chrome !== "undefined" && !!chrome.bookmarks;

function flattenBookmarkTree(treeNodes: BookmarkTreeNode[], results: SimplifiedBookmark[]) {
  for (const node of treeNodes) {
    results.push({
      id: node.id,
      title: node.title,
      url: node.url ?? undefined,
      dateAdded: node.dateAdded,
      parentId: node.parentId
    });
    if (node.children?.length) {
      flattenBookmarkTree(node.children, results);
    }
  }
}

/**
 * Chrome bookmark tree をフラットに取得する。
 *
 * - `includeFolders: true` の場合、フォルダノードも含めて返す（url は undefined）
 * - `includeFolders: false` の場合、URLを持つノードのみ返す（= 実際のブックマーク）
 */
export async function fetchBookmarkTree(options?: { includeFolders?: boolean }): Promise<SimplifiedBookmark[]> {
  if (!isExtensionRuntime()) {
    throw new Error("Chrome bookmarks API is not available in this environment.");
  }

  const nodes = await chrome.bookmarks.getTree();
  const results: SimplifiedBookmark[] = [];

  flattenBookmarkTree(nodes, results);

  const includeFolders = options?.includeFolders ?? true;
  return includeFolders ? results : results.filter((n) => typeof n.url === "string");
}

export async function fetchUrlBookmarks(): Promise<ChromeUrlBookmark[]> {
  const nodes = await fetchBookmarkTree({ includeFolders: false });
  return nodes
    .filter((n): n is SimplifiedBookmark & { url: string } => typeof n.url === "string" && n.url.length > 0)
    .map((n) => ({
      id: n.id,
      title: n.title,
      url: n.url,
      dateAdded: n.dateAdded,
      parentId: n.parentId
    }));
}

export type BookmarkEvent =
  | { type: "created"; payload: { id: string; node: chrome.bookmarks.BookmarkTreeNode } }
  | { type: "changed"; payload: { id: string; changeInfo: { title: string; url?: string } } }
  | { type: "removed"; payload: { id: string; removeInfo: { parentId: string; index: number; node: chrome.bookmarks.BookmarkTreeNode } } }
  | { type: "moved"; payload: { id: string; moveInfo: { parentId: string; index: number; oldParentId: string; oldIndex: number } } }
  | { type: "childrenReordered"; payload: { id: string; reorderInfo: { childIds: string[] } } }
  | { type: "importBegan"; payload: Record<string, never> }
  | { type: "importEnded"; payload: Record<string, never> };

export function subscribeToBookmarkEvents(callback: (event: BookmarkEvent) => void) {
  if (!isExtensionRuntime()) return () => undefined;

  const createdListener: Parameters<typeof chrome.bookmarks.onCreated.addListener>[0] = (id, node) =>
    callback({ type: "created", payload: { id, node } });

  const changedListener: Parameters<typeof chrome.bookmarks.onChanged.addListener>[0] = (id, changeInfo) =>
    callback({ type: "changed", payload: { id, changeInfo } });

  const removedListener: Parameters<typeof chrome.bookmarks.onRemoved.addListener>[0] = (id, removeInfo) =>
    callback({ type: "removed", payload: { id, removeInfo } });

  const movedListener: Parameters<typeof chrome.bookmarks.onMoved.addListener>[0] = (id, moveInfo) =>
    callback({ type: "moved", payload: { id, moveInfo } });

  const childrenReorderedListener: Parameters<typeof chrome.bookmarks.onChildrenReordered.addListener>[0] = (
    id,
    reorderInfo
  ) => callback({ type: "childrenReordered", payload: { id, reorderInfo } });

  const importBeganListener: Parameters<typeof chrome.bookmarks.onImportBegan.addListener>[0] = () =>
    callback({ type: "importBegan", payload: {} });

  const importEndedListener: Parameters<typeof chrome.bookmarks.onImportEnded.addListener>[0] = () =>
    callback({ type: "importEnded", payload: {} });

  chrome.bookmarks.onCreated.addListener(createdListener);
  chrome.bookmarks.onChanged.addListener(changedListener);
  chrome.bookmarks.onRemoved.addListener(removedListener);
  chrome.bookmarks.onMoved.addListener(movedListener);
  chrome.bookmarks.onChildrenReordered.addListener(childrenReorderedListener);
  chrome.bookmarks.onImportBegan.addListener(importBeganListener);
  chrome.bookmarks.onImportEnded.addListener(importEndedListener);

  return () => {
    chrome.bookmarks.onCreated.removeListener(createdListener);
    chrome.bookmarks.onChanged.removeListener(changedListener);
    chrome.bookmarks.onRemoved.removeListener(removedListener);
    chrome.bookmarks.onMoved.removeListener(movedListener);
    chrome.bookmarks.onChildrenReordered.removeListener(childrenReorderedListener);
    chrome.bookmarks.onImportBegan.removeListener(importBeganListener);
    chrome.bookmarks.onImportEnded.removeListener(importEndedListener);
  };
}

