import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import RouteUploader from "../components/RouteUploader";
import POIForm from "../components/POIForm";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();
const TAGS = ["All", "Routes", "Tips", "Review", "News", "Questions"];

export default function Community() {
  const auth = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeTag, setActiveTag] = useState("All");
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", tag: "Routes" });
  const [selectedThread, setSelectedThread] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  const fetchThreads = () => {
    fetch(`${API}/community/threads`)
      .then(r => r.json())
      .then(d => setThreads(d.threads || []))
      .catch(() => {});
  };

  useEffect(() => { fetchThreads(); }, []);

  const filtered = activeTag === "All" ? threads : threads.filter(t => t.tag === activeTag);

  const handleNewPost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    try {
      const res = await fetch(`${API}/community/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: auth.user?.email || "anonymous",
          title: newPost.title,
          content: newPost.content,
          tag: newPost.tag,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        fetchThreads();
        setNewPost({ title: "", content: "", tag: "Routes" });
        setShowNewPost(false);
      }
    } catch (e) { console.error(e); }
  };

  const deleteThread = async (threadUuid) => {
    try {
      await fetch(`${API}/community/threads/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_uuid: threadUuid }),
      });
      fetchThreads();
      setSelectedThread(null);
    } catch (e) { console.error(e); }
  };

  const openThread = (thread) => {
    setSelectedThread(thread);
    fetch(`${API}/community/comments?thread_uuid=${thread.thread_uuid}`)
      .then(r => r.json())
      .then(d => setComments(d.comments || []))
      .catch(() => setComments([]));
  };

  const postComment = async () => {
    if (!newComment.trim() || !selectedThread) return;
    try {
      await fetch(`${API}/community/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_uuid: selectedThread.thread_uuid,
          user_email: auth.user?.email || "anonymous",
          content: newComment.trim(),
        }),
      });
      setNewComment("");
      const res = await fetch(`${API}/community/comments?thread_uuid=${selectedThread.thread_uuid}`);
      const d = await res.json();
      setComments(d.comments || []);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#381D65]">Community</h1>
          <button onClick={() => setShowNewPost(!showNewPost)}
            className="bg-[#7A4BC8] text-white px-4 py-2 rounded-xl text-sm font-bold">
            {showNewPost ? "Close" : "+ New Post"}
          </button>
        </div>

        {showNewPost && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <input value={newPost.title} onChange={(e) => setNewPost({...newPost, title: e.target.value})}
              placeholder="Post title..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
            <textarea value={newPost.content} onChange={(e) => setNewPost({...newPost, content: e.target.value})}
              placeholder="Share your commute experience..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none resize-none" />
            <div className="flex items-center gap-2">
              <select value={newPost.tag} onChange={(e) => setNewPost({...newPost, tag: e.target.value})}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
                {TAGS.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={handleNewPost}
                className="ml-auto bg-[#7A4BC8] text-white px-4 py-1.5 rounded-lg text-xs font-bold">
                Post
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {TAGS.map(tag => (
            <button key={tag} onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${activeTag === tag ? "bg-[#7A4BC8] text-white" : "bg-white text-gray-500 border border-gray-200"}`}>
              {tag}
            </button>
          ))}
        </div>

        {filtered.map((thread) => (
          <div key={thread.thread_uuid} onClick={() => openThread(thread)}
            className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow">
            <span className="text-xs font-bold text-[#7A4BC8]">{thread.tag || "General"}</span>
            <h2 className="font-bold text-gray-900 mt-1">{thread.title}</h2>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{thread.content}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <span>{(thread.user_email || "anonymous").split("@")[0]}</span>
              <span>•</span>
              <span>{thread.created_at?.slice(0, 10)}</span>
              <button onClick={(e) => { e.stopPropagation(); openThread(thread); }}
                className="ml-auto text-[#7A4BC8] font-medium">
                Read more →
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedThread && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedThread(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7A4BC8]">{selectedThread.tag || "General"}</span>
              <div className="flex gap-2">
                <button onClick={() => deleteThread(selectedThread.thread_uuid)}
                  className="text-red-400 text-xs font-medium hover:text-red-600">Delete</button>
                <button onClick={() => setSelectedThread(null)} className="text-gray-400">✕</button>
              </div>
            </div>
            <h2 className="text-xl font-black text-gray-900 mt-1">{selectedThread.title}</h2>
            <p className="text-xs text-gray-400 mt-1">
              Posted by {(selectedThread.user_email || "anonymous").split("@")[0]} • {selectedThread.created_at?.slice(0, 10)}
            </p>
            <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{selectedThread.content}</div>

            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 mb-3">{comments.length} Comments</p>
              {comments.map((comment) => (
                <div key={comment.comment_uuid} className="mb-3 bg-gray-50 rounded-lg p-2">
                  <p className="text-xs font-semibold text-gray-700">{(comment.user_email || "anonymous").split("@")[0]}</p>
                  <p className="text-sm text-gray-600">{comment.content}</p>
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
                <button onClick={postComment}
                  className="bg-[#7A4BC8] text-white px-4 py-2 rounded-lg text-xs font-bold">
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
