import { useState, useEffect, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useLocation } from 'react-router-dom';
import indexMd from '../../index.md?raw';

const components = {
    h1: ({ children, ...props }) => (
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent animate-fade-in" {...props}>
            {children}
        </h1>
    ),
    h2: ({ children, ...props }) => {
        // Simple extraction of ID from text content if present: "Title {#id}"
        let id = undefined;
        let content = children;

        if (typeof children === 'string' && children.includes('{#')) {
            const match = children.match(/(.*)\s{#([^}]+)}/);
            if (match) {
                content = match[1];
                id = match[2];
            }
        }

        // Also handle array of children if mixed content
        if (Array.isArray(children)) {
            const lastChild = children[children.length - 1];
            if (typeof lastChild === 'string' && lastChild.includes('{#')) {
                const match = lastChild.match(/(.*)\s{#([^}]+)}/);
                if (match) {
                    // This is a naive replacement, but works for simple cases
                    const newChildren = [...children];
                    newChildren[newChildren.length - 1] = match[1];
                    content = newChildren;
                    id = match[2];
                }
            }
        }

        return (
            <h2 id={id} className="text-3xl md:text-4xl font-bold mt-12 mb-6 text-slate-100 flex items-center gap-2 group" {...props}>
                {content}
                {id && <a href={`#${id}`} className="opacity-0 group-hover:opacity-50 text-slate-500 text-lg transition-opacity">#</a>}
            </h2>
        );
    },
    h3: ({ children, ...props }) => (
        <h3 className="text-2xl md:text-3xl font-semibold mt-8 mb-4 text-slate-200" {...props}>
            {children}
        </h3>
    ),
    p: ({ children, ...props }) => {
        // Check for [youtube:VIDEO_ID] pattern
        if (typeof children === 'string') {
            const youtubeMatch = children.match(/\[youtube:([a-zA-Z0-9_-]+)\]/);
            if (youtubeMatch) {
                const videoId = youtubeMatch[1];
                return <YouTubeEmbed videoId={videoId} />;
            }
        }
        // Also check if children is an array with a string containing the pattern
        if (Array.isArray(children)) {
            for (const child of children) {
                if (typeof child === 'string') {
                    const youtubeMatch = child.match(/\[youtube:([a-zA-Z0-9_-]+)\]/);
                    if (youtubeMatch) {
                        const videoId = youtubeMatch[1];
                        return <YouTubeEmbed videoId={videoId} />;
                    }
                }
            }
        }
        return (
            <p className="text-lg text-slate-300 leading-relaxed mb-6" {...props}>
                {children}
            </p>
        );
    },
    a: ({ href, children, ...props }) => {
        const isExternal = href?.startsWith('http');
        const isHash = href?.startsWith('#');
        const isInternal = !isExternal && !isHash;
        const isGitHub = href?.includes('github.com');

        // GitHub profile links with icon
        if (isGitHub) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium rounded-lg transition-colors border border-slate-600 hover:border-slate-500"
                    title="View GitHub Profile"
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    {children}
                </a>
            );
        }

        if (isInternal) {
            // Handle case-studies/*.md links. Transform to /case-study/slug
            // The link in markdown is like 'case-studies/accident-detection.md'
            // We want '/case-study/accident-detection'

            let to = href;
            if (href.startsWith('case-studies/')) {
                const slug = href.replace('case-studies/', '').replace('.md', '');
                to = `/case-study/${slug}`;
            }

            return (
                <Link to={to} className="text-accent-400 hover:text-accent-300 font-medium underline decoration-accent-400/30 hover:decoration-accent-400 transition-colors" {...props}>
                    {children}
                </Link>
            );
        }

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
        <ul className="list-disc list-inside space-y-2 mb-6 text-slate-300" {...props}>
            {children}
        </ul>
    ),
    li: ({ children, ...props }) => (
        <li className="ml-4" {...props}>
            {children}
        </li>
    ),
    hr: () => <hr className="border-white/10 my-12" />,
    blockquote: ({ children, ...props }) => (
        <blockquote className="border-l-4 border-accent-500 pl-4 italic text-slate-400 my-6" {...props}>
            {children}
        </blockquote>
    ),
    strong: ({ children, ...props }) => (
        <strong className="font-bold text-slate-100" {...props}>{children}</strong>
    ),
    img: ({ src, alt, ...props }) => {
        const imagePath = src?.startsWith('./') ? src.replace('./', '/') : src;
        return (
            <div className="my-8">
                <img
                    src={imagePath}
                    alt={alt}
                    className="rounded-xl shadow-xl w-full h-auto border border-white/10"
                    {...props}
                />
            </div>
        );
    },
};

const YouTubeEmbed = ({ url, videoId: directVideoId }) => {
    const getVideoId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const videoId = directVideoId || getVideoId(url);

    if (!videoId) return null;

    return (
        <div className="relative w-full pb-[56.25%] my-6 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-black">
            <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
            ></iframe>
        </div>
    );
};

const YouTubeIcon = ({ url }) => (
    <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center p-2 bg-[#FF0000]/10 hover:bg-[#FF0000]/20 text-[#FF0000] rounded-full transition-colors border border-[#FF0000]/20 hover:border-[#FF0000]/40 align-middle ml-2"
        title="Watch on YouTube"
    >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
    </a>
);

const HomePage = () => {
    const location = useLocation();

    useLayoutEffect(() => {
        // Disable browser's automatic scroll restoration
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }

        const savedPos = sessionStorage.getItem('homeScrollPos');

        if (location.hash) {
            const id = location.hash.substring(1);
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'auto' });
            } else {
                // Fallback for elements not yet rendered
                setTimeout(() => {
                    document.getElementById(id)?.scrollIntoView({ behavior: 'auto' });
                }, 0);
            }
        } else if (savedPos) {
            window.scrollTo({ top: parseInt(savedPos), behavior: 'instant' });
        } else {
            window.scrollTo(0, 0);
        }

        const handleScroll = () => {
            sessionStorage.setItem('homeScrollPos', window.scrollY.toString());
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [location]);

    return (
        <div className="section-container min-h-screen pt-24">
            <div className="prose prose-invert prose-lg max-w-none">
                <ReactMarkdown components={components}>
                    {indexMd}
                </ReactMarkdown>

                {/* Contact Section */}
                <div id="contact" className="mt-24 mb-16 pt-12 border-t border-white/10">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-100 flex items-center gap-2">
                        Contact
                    </h2>
                    <p className="text-lg text-slate-300 leading-relaxed mb-8">
                        Ready to build an AI solution or automate your business?
                    </p>

                    <div className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-white/10 shadow-xl max-w-2xl">
                        <h3 className="text-2xl font-semibold mb-6 text-slate-100 flex items-center gap-2">
                            📩 Get in Touch
                        </h3>

                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <a
                                href="mailto:umarattique9@gmail.com"
                                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 font-bold rounded-xl border border-primary-500/30 hover:border-primary-500/50 transition-all hover:scale-[1.02]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Email Me
                            </a>

                            <a
                                href="https://wa.me/923277343906"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold rounded-xl border border-[#25D366]/30 hover:border-[#25D366]/50 transition-all hover:scale-[1.02]"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                WhatsApp
                            </a>
                        </div>

                        <p className="text-slate-400 text-sm flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Available for remote projects worldwide.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
