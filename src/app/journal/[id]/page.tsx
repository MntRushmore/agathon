'use client';

import { useEffect, useState, useCallback, useRef, KeyboardEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import {
  Lightbulb,
  Timer,
  MoreHorizontal,
  Loader2,
  Plus,
  Sparkles,
  Layers,
  ClipboardList,
  Square,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ImagePlus,
} from 'lucide-react';
import { debounce } from 'lodash';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/journal/RichTextEditor';

interface JournalData {
  id: string;
  user_id: string;
  title: string;
  content: any[];
  created_at: string;
  updated_at: string;
}

// Slash command menu items
const slashCommands = [
  {
    category: 'Build with Feynman',
    items: [
      { id: 'notes', icon: Sparkles, label: 'Generate notes', color: 'text-green-600 bg-green-50' },
      { id: 'practice', icon: ClipboardList, label: 'Generate practice problems', color: 'text-gray-600' },
      { id: 'flashcards', icon: Layers, label: 'Generate flashcards', color: 'text-blue-600 bg-blue-50' },
      { id: 'image', icon: ImagePlus, label: 'Generate image', color: 'text-gray-600' },
    ],
  },
  {
    category: 'Basic editing',
    items: [
      { id: 'text', icon: Type, label: 'Text', color: 'text-gray-600' },
      { id: 'h1', icon: Heading1, label: 'Heading 1', color: 'text-gray-600' },
      { id: 'h2', icon: Heading2, label: 'Heading 2', color: 'text-gray-600' },
      { id: 'h3', icon: Heading3, label: 'Heading 3', color: 'text-gray-600' },
      { id: 'bullet', icon: List, label: 'Bullet list', color: 'text-gray-600' },
    ],
  },
];

export default function JournalEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [journal, setJournal] = useState<JournalData | null>(null);
  const [title, setTitle] = useState('New Journal');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Topic prompt modal state
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState('');

  // Command input state
  const [commandInput, setCommandInput] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [slashFilter, setSlashFilter] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);



  // Load journal
  useEffect(() => {
    async function loadJournal() {
      if (!user || !params.id) return;

      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error('Failed to load journal:', error);
        toast.error('Failed to load journal');
        router.push('/journal');
        return;
      }

      setJournal(data);
      setTitle(data.title);
      const textContent = Array.isArray(data.content)
        ? data.content.map((block: any) =>
            typeof block === 'string' ? block : block?.content || ''
          ).join('\n')
        : '';
      setContent(textContent);
      setLastSaved(new Date(data.updated_at));
      setLoading(false);
    }

    loadJournal();
  }, [params.id, user, supabase, router]);

  // Auto-save with debounce
  const saveJournal = useCallback(
    debounce(async (newTitle: string, newContent: string) => {
      if (!journal) return;

      setIsSaving(true);

      const { error } = await supabase
        .from('journals')
        .update({
          title: newTitle,
          content: [{ type: 'text', content: newContent }],
          updated_at: new Date().toISOString(),
        })
        .eq('id', journal.id);

      if (error) {
        console.error('Failed to save journal:', error);
      } else {
        setLastSaved(new Date());
      }

      setIsSaving(false);
    }, 1000),
    [journal, supabase]
  );

  // Save on changes
  useEffect(() => {
    if (journal && !loading) {
      saveJournal(title, content);
    }
  }, [title, content, journal, loading, saveJournal]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  // Generate AI content
  const generateAIContent = async (type: string, customTopic?: string) => {
    setIsGenerating(true);
    const typeLabel = type === 'notes' ? 'notes' : type === 'flashcards' ? 'flashcards' : type === 'practice' ? 'practice problems' : 'content';
    const toastId = toast.loading(`Generating ${typeLabel}...`);

    try {
      const response = await fetch('/api/journal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content: content || customTopic || title,
          topic: customTopic || title,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();

      // Set the generated content
      const newContent = content ? content + '\n\n' + data.content : data.content;
      setContent(newContent);

      toast.success(`${typeLabel} generated!`, { id: toastId });
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate content', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setPendingAction(action);
    setTopicInput('');
    setShowTopicModal(true);
  };

  const handleTopicSubmit = async () => {
    if (!pendingAction || !topicInput.trim()) return;

    const actionMap: Record<string, string> = {
      'Feynman Method': 'notes',
      'Flashcards': 'flashcards',
      'Practice Problems': 'practice',
      'Notes': 'notes',
    };

    const commandId = actionMap[pendingAction];
    setShowTopicModal(false);
    
    if (commandId) {
      // Update the title to the topic
      setTitle(topicInput.trim());
      await generateAIContent(commandId, topicInput.trim());
    }
    
    setPendingAction(null);
    setTopicInput('');
  };

  const getActionPromptText = (action: string): string => {
    switch (action) {
      case 'Feynman Method':
        return 'What topic would you like Feynman to teach you about?';
      case 'Flashcards':
        return 'What topic would you like to create flashcards for?';
      case 'Practice Problems':
        return 'What topic would you like practice problems for?';
      case 'Notes':
        return 'What topic would you like notes on?';
      default:
        return 'What topic would you like to explore?';
    }
  };

  // Get all flat commands for navigation
  const getAllCommands = () => {
    const filtered = slashFilter.toLowerCase();
    return slashCommands.flatMap(cat =>
      cat.items.filter(item =>
        item.label.toLowerCase().includes(filtered)
      )
    );
  };

  // Handle command input changes
  const handleCommandInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCommandInput(value);

    // Check for slash command
    if (value.startsWith('/')) {
      setSlashFilter(value.slice(1));
      setShowSlashMenu(true);
      setSelectedCommandIndex(0);
    } else {
      setShowSlashMenu(false);
      setSlashFilter('');
    }
  };

  // Handle keyboard navigation in slash menu
  const handleCommandKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSlashMenu) {
      if (e.key === 'Enter' && commandInput.trim()) {
        // Add as plain text content
        const newContent = content ? content + '\n\n' + commandInput : commandInput;
        setContent(newContent);
        setCommandInput('');
      }
      return;
    }

    const allCommands = getAllCommands();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCommandIndex(prev =>
        prev < allCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCommandIndex(prev =>
        prev > 0 ? prev - 1 : allCommands.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedCommand = allCommands[selectedCommandIndex];
      if (selectedCommand) {
        executeCommand(selectedCommand.id);
      }
    } else if (e.key === 'Escape') {
      setShowSlashMenu(false);
      setCommandInput('');
    }
  };

  // Execute a slash command
  const executeCommand = async (commandId: string) => {
    setShowSlashMenu(false);
    setCommandInput('');

    const aiCommands = ['notes', 'practice', 'flashcards', 'image'];
    const formatCommands = ['text', 'h1', 'h2', 'h3', 'bullet'];

    if (aiCommands.includes(commandId)) {
      // For AI commands, show the topic modal
      const actionMap: Record<string, string> = {
        'notes': 'Notes',
        'practice': 'Practice Problems',
        'flashcards': 'Flashcards',
        'image': 'Notes',
      };
      handleQuickAction(actionMap[commandId] || 'Notes');
    } else if (formatCommands.includes(commandId)) {
      // Insert formatting into content
      let insertText = '';
      switch (commandId) {
        case 'h1':
          insertText = '# ';
          break;
        case 'h2':
          insertText = '## ';
          break;
        case 'h3':
          insertText = '### ';
          break;
        case 'bullet':
          insertText = '- ';
          break;
        default:
          insertText = '';
      }
      const newContent = content ? content + '\n\n' + insertText : insertText;
      setContent(newContent);
    }
  };

  // Close slash menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSlashMenu(false);
    if (showSlashMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSlashMenu]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FAF9F6]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const isEmpty = !content || content.trim() === '';
  const allCommands = getAllCommands();

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Loading overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
            <span className="text-gray-700 font-medium">Generating content...</span>
          </div>
        </div>
      )}

      {/* Topic Prompt Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {pendingAction === 'Feynman Method' && 'Ask Feynman to teach you'}
                {pendingAction === 'Flashcards' && 'Create flashcards'}
                {pendingAction === 'Practice Problems' && 'Generate practice problems'}
                {pendingAction === 'Notes' && 'Create notes'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {getActionPromptText(pendingAction || '')}
              </p>
              <input
                type="text"
                autoFocus
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && topicInput.trim()) {
                    handleTopicSubmit();
                  } else if (e.key === 'Escape') {
                    setShowTopicModal(false);
                    setPendingAction(null);
                    setTopicInput('');
                  }
                }}
                placeholder="e.g., Addition, Fractions, Photosynthesis..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all"
              />
            </div>
            <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowTopicModal(false);
                  setPendingAction(null);
                  setTopicInput('');
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTopicSubmit}
                disabled={!topicInput.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        {/* Left - Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/journal')}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <Square className="h-5 w-5 text-gray-800 fill-gray-800" strokeWidth={2} />
          </button>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            className="text-base font-semibold bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-400 focus:ring-0"
            placeholder="New Journal"
          />
        </div>

        {/* Center - Command bar */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="relative">
            <div
              onClick={() => !searchExpanded && setSearchExpanded(true)}
              className={cn(
                'flex items-center gap-3 bg-[#D1E7D5] rounded-xl px-4 py-2.5 cursor-pointer',
                'transition-all duration-300 ease-out',
                searchExpanded
                  ? 'min-w-[600px] bg-[#C5DFC9] shadow-lg'
                  : 'min-w-[400px] hover:bg-[#C5DFC9]'
              )}
            >
              <Plus className="h-5 w-5 text-[#2D5A3D] flex-shrink-0" />
              {searchExpanded ? (
                <input
                  ref={commandInputRef}
                  type="text"
                  autoFocus
                  value={commandInput}
                  onChange={handleCommandInputChange}
                  onBlur={() => {
                    if (!commandInput.trim() && !showSlashMenu) {
                      setSearchExpanded(false);
                    }
                  }}
                  onKeyDown={handleCommandKeyDown}
                  placeholder='Type "/" for commands or ask a question...'
                  className="flex-1 bg-transparent border-none outline-none text-[#2D5A3D] text-sm placeholder:text-[#2D5A3D]/60 focus:ring-0"
                />
              ) : (
                <span className="text-[#2D5A3D] text-sm">Ask to explain a concept</span>
              )}
            </div>

            {/* Slash Command Menu */}
            {showSlashMenu && searchExpanded && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl shadow-lg border border-gray-100 py-3 max-h-[420px] overflow-y-auto">
                {slashCommands.map((category, catIndex) => {
                  const filteredItems = category.items.filter(item =>
                    item.label.toLowerCase().includes(slashFilter.toLowerCase())
                  );

                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={category.category} className={catIndex > 0 ? 'mt-2' : ''}>
                      <div className="px-4 py-1.5 text-xs font-medium text-gray-400">
                        {category.category}
                      </div>
                      {filteredItems.map((item) => {
                        const globalIndex = allCommands.findIndex(c => c.id === item.id);
                        const isSelected = globalIndex === selectedCommandIndex;
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            onClick={() => executeCommand(item.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                              isSelected ? 'bg-[#E8F5E9]' : 'hover:bg-gray-50'
                            )}
                          >
                            <Icon className={cn(
                              'h-5 w-5',
                              isSelected ? 'text-green-600' :
                              item.id === 'notes' ? 'text-green-600' :
                              item.id === 'flashcards' ? 'text-blue-500' :
                              'text-gray-400'
                            )} />
                            <span className={cn(
                              'text-sm',
                              isSelected ? 'text-green-600 font-medium' : 'text-gray-700'
                            )}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1">
          <button
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            onClick={() => toast.info('Ideas feature coming soon!')}
          >
            <Lightbulb className="h-5 w-5" />
          </button>
          <button
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            onClick={() => toast.info('Timer feature coming soon!')}
          >
            <Timer className="h-5 w-5" />
          </button>
          <button
            className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            onClick={() => toast.info('More options coming soon!')}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          <button
            onClick={() => toast.info('Sharing is coming soon!')}
            className="ml-2 bg-[#16A34A] hover:bg-[#15803d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Share
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-8 py-6 max-w-4xl mx-auto">
        {/* Start with section - only show when empty */}
        {isEmpty && (
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-3">Start with</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickAction('Notes')}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D1E7D5] text-[#2D5A3D] text-sm font-medium hover:bg-[#C5DFC9] transition-colors disabled:opacity-50 shadow-sm"
              >
                <Type className="h-4 w-4" />
                Create notes
              </button>
              <button
                onClick={() => handleQuickAction('Feynman Method')}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D1E7D5] text-[#2D5A3D] text-sm font-medium hover:bg-[#C5DFC9] transition-colors disabled:opacity-50 shadow-sm"
              >
                <Sparkles className="h-4 w-4" />
                Ask Feynman to teach you
              </button>
              <button
                onClick={() => handleQuickAction('Flashcards')}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D1E7D5] text-[#2D5A3D] text-sm font-medium hover:bg-[#C5DFC9] transition-colors disabled:opacity-50 shadow-sm"
              >
                <Layers className="h-4 w-4" />
                Study with flashcards
              </button>
              <button
                onClick={() => handleQuickAction('Practice Problems')}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D1E7D5] text-[#2D5A3D] text-sm font-medium hover:bg-[#C5DFC9] transition-colors disabled:opacity-50 shadow-sm"
              >
                <ClipboardList className="h-4 w-4" />
                Create practice problems
              </button>
            </div>
          </div>
        )}

        {/* WYSIWYG Rich Text Editor */}
        <div className="relative min-h-[60vh] pb-20">
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing or click a button above to generate notes..."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 right-0 px-6 py-4">
        <span className="text-xs text-gray-400">
          {isSaving ? (
            'Saving...'
          ) : lastSaved ? (
            `Last saved ${formatDistance(lastSaved, new Date(), { addSuffix: true })}`
          ) : (
            ''
          )}
        </span>
      </footer>
    </div>
  );
}
