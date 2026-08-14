import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import ReactMarkdown from "react-markdown";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

export default function ArticlePage() {
  const { slug } = useParams();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/articles/${slug}`)
      .then(r => r.json())
      .then(d => setContent(d.content || ""))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <article className="max-w-3xl mx-auto px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="prose prose-lg prose-purple max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </article>
      <BottomNav />
    </div>
  );
}
