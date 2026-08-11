import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import RouteUploader from "../components/RouteUploader";
import POIForm from "../components/POIForm";
import { useAuth } from "../context/AuthContext";

const MOCK_THREADS = [
  { id: 1, user: "JuanDelaCruz", title: "Best Cubao to Makati route at 7am?", replies: 24, votes: 15, time: "2h ago", tag: "Routes", content: "I've been trying different jeep routes from Cubao to Makati. The EDSA Carousel is fast but crowded. Any alternatives?" },
  { id: 2, user: "CommuterQueen", title: "PSA: EDSA Carousel now has free WiFi!", replies: 18, votes: 42, time: "4h ago", tag: "Tips", content: "Just discovered that EDSA Carousel buses now have free WiFi. Game changer for the morning commute!" },
  { id: 3, user: "JeepneyKing", title: "New UV Express terminal at Ayala - review", replies: 31, votes: 28, time: "6h ago", tag: "Review", content: "The new UV Express terminal near Ayala MRT is much better organized. Less waiting time compared to the old one." },
  { id: 4, user: "TrafficWizard", title: "LRT-1 extension update: when will it open?", replies: 56, votes: 89, time: "8h ago", tag: "News", content: "Anyone have updates on the LRT-1 Cavite extension? Last I heard was Q4 2024 but seems delayed again." },
  { id: 5, user: "BudgetBiyahe", title: "Cheapest way from Fairview to PITX?", replies: 12, votes: 7, time: "10h ago", tag: "Routes", content: "Budget is tight this week. Need the absolute cheapest way to get from Fairview to PITX. Willing to transfer multiple times." },
];

const TAGS = ["All", "Routes", "Tips", "Review", "News", "Questions"];

export default function Community() {
  let auth = { isAuthenticated: false };
  try { auth = useAuth(); } catch (_) {}
  const [showCTA, setShowCTA] = useState(!auth.isAuthenticated);
  const [showUpload, setShowUpload] = useState(false);
  const [showPOI, setShowPOI] = useState(false);
  const [threads, setThreads] = useState(MOCK_THREADS);
  const [activeTag, setActiveTag] = useState("All");
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", tag: "Routes" });

  const filtered = activeTag === "All" ? threads : threads.filter(t => t.tag === activeTag);

  const handleNewPost = () => {
    if (!newPost.title.trim() || !newPost.content.trim()) return;
    const post = {
      id: threads.length + 1,
      user: auth.user?.displayName || auth.user?.email?.split("@")[0] || "Commuter",
      title: newPost.title,
      content: newPost.content,
      tag: newPost.tag,
      replies: 0,
      votes: 0,
      time: "just now",
    };
    setThreads([post, ...threads]);
    setNewPost({ title: "", content: "", tag: "Routes" });
    setShowNewPost(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Signup CTA */}
      {showCTA && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
            <span className="text-5xl">🌟</span>
            <h2 className="text-2xl font-black text-[#381D65] mt-4">Join the Community</h2>
            <p className="text-gray-500 mt-2 text-sm">Share routes, get tips, and help fellow commuters.</p>
            <Link to="/signup" className="block w-full mt-6 py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm">Sign Up — It's Free</Link>
            <button onClick={() => setShowCTA(false)} className="block w-full mt-2 py-2 text-gray-400 text-xs">Maybe later</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-[#381D65] to-[#7A4BC8] text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h2 className="text-xl font-black">Bawat biyahe, tulong sa komunidad. 🇵🇭</h2>
          <p className="text-sm text-white/80 mt-2">Share routes, tips, and stories with fellow Metro Manila commuters.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Action bar */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setShowNewPost(true)}
            className="bg-[#7A4BC8] text-white px-4 py-2 rounded-full text-xs font-bold">
            + New Post
          </button>
          <button onClick={() => setShowUpload(!showUpload)}
            className={`px-4 py-2 rounded-full text-xs font-bold border ${showUpload ? "bg-gray-100 text-gray-600" : "border-[#7A4BC8] text-[#7A4BC8]"}`}>
            {showUpload ? "✕ Close" : "📡 Record Route"}
          </button>
          <button onClick={() => setShowPOI(!showPOI)}
            className={`px-4 py-2 rounded-full text-xs font-bold border ${showPOI ? "bg-gray-100 text-gray-600" : "border-[#7A4BC8] text-[#7A4BC8]"}`}>
            {showPOI ? "✕ Close" : "📍 Add Place"}
          </button>
        </div>

        {/* Route Upload Form */}
        {showUpload && (
          <div className="mb-6">
            <RouteUploader onSuccess={() => setShowUpload(false)} />
          </div>
        )}

        {/* New Post Form */}
        {showNewPost && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <input value={newPost.title} onChange={(e) => setNewPost({...newPost, title: e.target.value})}
              placeholder="Post title..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none" />
            <textarea value={newPost.content} onChange={(e) => setNewPost({...newPost, content: e.target.value})}
              placeholder="Share your commute experience, tips, or questions..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none resize-none" />
            <div className="flex items-center gap-2">
              <select value={newPost.tag} onChange={(e) => setNewPost({...newPost, tag: e.target.value})}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
                {TAGS.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={handleNewPost}
                className="ml-auto bg-[#7A4BC8] text-white px-4 py-1.5 rounded-lg text-xs font-bold">Post</button>
              <button onClick={() => setShowNewPost(false)}
                className="text-gray-400 text-xs">Cancel</button>
            </div>
          </div>
        )}

        {/* Tag filters */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {TAGS.map(tag => (
            <button key={tag} onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap ${
                activeTag === tag ? "bg-[#7A4BC8] text-white" : "bg-white text-gray-500 border border-gray-200"
              }`}>
              {tag}
            </button>
          ))}
        </div>

        {/* Thread list */}
        <div className="space-y-3">
          {filtered.map((thread) => (
            <div key={thread.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-[#D1B6FC] flex items-center justify-center text-[10px] font-bold text-[#381D65]">
                  {thread.user[0]}
                </span>
                <span className="text-xs font-medium text-gray-500">{thread.user}</span>
                <span className="text-[10px] text-gray-300">{thread.time}</span>
                <span className="ml-auto text-[10px] bg-[#7A4BC81A] text-[#7A4BC8] px-2 py-0.5 rounded-full font-bold">{thread.tag}</span>
              </div>
              <h3 className="font-bold text-[#381D65] text-sm mb-1">{thread.title}</h3>
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">{thread.content}</p>
              <div className="flex gap-4 text-[10px] text-gray-400">
                <span>💬 {thread.replies} replies</span>
                <span>⬆ {thread.votes} votes</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="md:hidden"><BottomNav /></div>
    </div>
  );
}
