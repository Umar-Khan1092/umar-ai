import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const modules = import.meta.glob('../../case-studies/*.md', { query: '?raw', import: 'default', eager: true });

const components = {
    h1: ({ children, ...props }) => (
        <h1 className="text-4xl md:text-5xl font-extrabold mb-8 bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent animate-fade-in" {...props}>
            {children}
        </h1>
    ),
    h2: ({ children, ...props }) => (
        <h2 className="text-3xl md:text-4xl font-bold mt-12 mb-6 text-slate-100 flex items-center gap-2" {...props}>
            {children}
        </h2>
    ),
    h3: ({ children, ...props }) => (
        <h3 className="text-2xl md:text-3xl font-semibold mt-8 mb-4 text-slate-200" {...props}>
            {children}
        </h3>
    ),
    p: ({ children, ...props }) => (
        <p className="text-lg text-slate-300 leading-relaxed mb-6" {...props}>
            {children}
        </p>
    ),
    a: ({ href, children, ...props }) => {
        const isExternal = href?.startsWith('http');
        return (
            <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-primary-400 hover:text-primary-300 font-medium underline decoration-primary-400/30 hover:decoration-primary-400 transition-colors"
                {...props}
            >
                {children}
            </a>
        );
    },
    ul: ({ children, ...props }) => (
        <ul className="list-disc list-inside space-y-2 mb-6 text-slate-300 pl-4 border-l border-white/10" {...props}>
            {children}
        </ul>
    ),
    li: ({ children, ...props }) => (
        <li className="pl-2" {...props}>
            {children}
        </li>
    ),
    blockquote: ({ children, ...props }) => (
        <blockquote className="border-l-4 border-accent-500 pl-6 italic text-slate-400 my-8 py-2 bg-white/5 rounded-r-lg" {...props}>
            {children}
        </blockquote>
    ),
    img: ({ src, alt, ...props }) => {
        // Handle relative paths like ./images/ to map correctly to /images/
        const imagePath = src?.startsWith('./') ? src.replace('./', '/') : src;
        return (
            <div className="my-12">
                <img
                    src={imagePath}
                    alt={alt}
                    className="rounded-2xl shadow-2xl w-full h-auto border border-white/10"
                    {...props}
                />
            </div>
        );
    },
    code: ({ node, inline, className, children, ...props }) => {
        return (
            <code className={`${inline ? 'bg-slate-800 text-primary-300 px-1 py-0.5 rounded' : 'block bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm text-slate-300 font-mono my-4'}`} {...props}>
                {children}
            </code>
        )
    }
};

const CaseStudyPage = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [markdownContent, setMarkdownContent] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState(null);
    const [showVideo, setShowVideo] = useState(false);
    const [loading, setLoading] = useState(true);
    const videoRef = useRef(null);

    // Scroll to top when page loads
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    useEffect(() => {
        const loadContent = async () => {
            try {
                let content = '';

                // Try to find the matching module
                for (const [key, value] of Object.entries(modules)) {
                    if (key.endsWith(`/${slug}.md`) || key.endsWith(`\\${slug}.md`)) {
                        content = value;
                        break;
                    }
                }

                if (content) {
                    // Extract YouTube URL from content (pattern: 🎥 Demo Video: <url> or just a YouTube URL)
                    const youtubeRegex = /(https?:\/\/(www\.)?(youtube\.com|youtu\.be)[^\s\n]+)/gi;
                    const matches = content.match(youtubeRegex);

                    if (matches && matches.length > 0) {
                        setYoutubeUrl(matches[0]);
                        // Remove the line containing the YouTube URL from display
                        content = content.replace(/🎥.*\n?/gi, '');
                    }

                    setMarkdownContent(content);
                } else {
                    setMarkdownContent('# Case Study Not Found\nSorry, the requested case study could not be loaded.');
                }
                setLoading(false);
            } catch (error) {
                console.error('Error loading markdown:', error);
                setMarkdownContent('# Error\nFailed to load content.');
                setLoading(false);
            }
        };

        loadContent();
    }, [slug]);

    const getVideoId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const YouTubeButton = () => (
        <button
            onClick={() => setShowVideo(true)}
            className="inline-flex items-center gap-3 px-6 py-3 bg-[#FF0000]/10 hover:bg-[#FF0000]/20 text-[#FF0000] font-bold rounded-xl transition-all border border-[#FF0000]/20 hover:border-[#FF0000]/40 hover:scale-[1.02] mb-8"
        >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            Watch Demo Video
        </button>
    );

    const YouTubeEmbed = () => {
        const videoId = getVideoId(youtubeUrl);
        if (!videoId) return null;

        return (
            <div className="mb-8">
                <div className="relative w-full pb-[56.25%] rounded-xl overflow-hidden shadow-lg border border-white/10 bg-black">
                    <iframe
                        className="absolute top-0 left-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                    ></iframe>
                </div>
                <button
                    onClick={() => setShowVideo(false)}
                    className="mt-4 text-slate-400 hover:text-white text-sm transition-colors"
                >
                    ← Hide Video
                </button>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    const videoId = getVideoId(youtubeUrl);

    return (
        <div className="min-h-screen pt-32 pb-16">
            {/* Fixed Navigation Bar */}
            <div className="fixed top-16 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-white/10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                    <Link to="/" className="inline-flex items-center text-slate-400 hover:text-white transition-colors group text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Home
                    </Link>

                    {youtubeUrl && (
                        <button
                            onClick={() => {
                                const newState = !showVideo;
                                setShowVideo(newState);
                                if (newState) {
                                    // Scroll to video after it appears
                                    setTimeout(() => {
                                        videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }, 100);
                                }
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FF0000]/10 hover:bg-[#FF0000]/20 text-[#FF0000] text-sm font-medium rounded-lg transition-all border border-[#FF0000]/20 hover:border-[#FF0000]/40"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                            </svg>
                            {showVideo ? 'Hide Video' : 'Watch Demo'}
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* YouTube Video Section - Shows when toggled */}
                {youtubeUrl && showVideo && videoId && (
                    <div ref={videoRef} className="mb-8 scroll-mt-32">
                        <div className="relative w-full pb-[56.25%] rounded-xl overflow-hidden shadow-lg border border-white/10 bg-black">
                            <iframe
                                className="absolute top-0 left-0 w-full h-full"
                                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                loading="lazy"
                            ></iframe>
                        </div>
                    </div>
                )}

                <article className="prose prose-invert prose-lg max-w-none bg-slate-900/50 backdrop-blur-sm p-8 md:p-12 rounded-2xl border border-white/10 shadow-2xl">
                    <ReactMarkdown components={components}>
                        {markdownContent}
                    </ReactMarkdown>
                </article>
            </div>
        </div>
    );
};

export default CaseStudyPage;
