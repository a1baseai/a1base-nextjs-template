'use client';

import { useEffect, useState } from 'react';

interface JsonFile {
  name: string;
  content: any;
}

export default function DataViewerPage() {
  const [jsonFiles, setJsonFiles] = useState<JsonFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadJsonFiles = async () => {
      try {
        const response = await fetch('/api/data-files');
        const files = await response.json();
        setJsonFiles(files);
      } catch (error) {
        console.error('Error loading JSON files:', error);
      } finally {
        setLoading(false);
      }
    };

    loadJsonFiles();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 font-mono text-xl animate-pulse">
          Loading data files...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400 p-6 font-mono">
      <div className="w-full">
        {/* Main Terminal Header */}
        <div className="bg-gray-900 rounded-t-lg border border-gray-800 p-2 flex items-center space-x-2 mb-6 max-w-7xl mx-auto">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="flex-1 text-center text-gray-400 text-sm">
            A1 - Personality, Data & settings Viewer Terminal
          </div>
        </div>

        {/* Grid of JSON Files */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {jsonFiles.map((file) => (
            <div key={file.name} className="flex flex-col">
              {/* Individual Terminal Window */}
              <div className="bg-gray-900 rounded-t-lg border border-gray-800 p-1.5 flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 text-center text-gray-400 text-xs truncate">
                  {file.name}
                </div>
              </div>
              
              {/* Terminal Content */}
              <div className="bg-gray-950 rounded-b-lg border-x border-b border-gray-800 p-3 flex-1 flex flex-col">
                <div className="mb-2 text-xs">
                  <span className="text-cyan-400">$</span> cat{' '}
                  <span className="text-yellow-400">{file.name}</span>
                </div>
                <div className="bg-gray-900 rounded p-3 overflow-auto flex-1 max-h-[400px]">
                  <pre className="text-xs">
                    <code className="language-json">
                      {JSON.stringify(file.content, null, 2)
                        .split('\n')
                        .map((line, index) => (
                          <div key={index} className="hover:bg-gray-800 px-1 -mx-1">
                            <span className="text-gray-600 select-none mr-2 inline-block w-6 text-right">
                              {index + 1}
                            </span>
                            {highlightJson(line)}
                          </div>
                        ))}
                    </code>
                  </pre>
                </div>
                <div className="mt-2 flex items-center text-xs">
                  <span className="text-cyan-400">$</span>
                  <span className="ml-1 animate-pulse">_</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function highlightJson(line: string): React.ReactElement {
  // Simple JSON syntax highlighting
  const highlighted = line
    .replace(/(".*?")/g, '<span class="text-yellow-300">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="text-orange-400">$1</span>')
    .replace(/([{}[\],:])/g, '<span class="text-gray-400">$1</span>')
    .replace(/(\b\d+\.?\d*\b)(?![">])/g, '<span class="text-purple-400">$1</span>');

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
} 