import { useState } from "react";
import { TableTools } from "./components/TableTools";
import { CopyTools } from "./components/CopyTools";
import { useChromeAPI } from "./hooks/useChromeAPI";

function App() {
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("tables");
  const { sendMessage } = useChromeAPI();

  return (
    <div className="w-[380px] min-h-[500px] bg-gradient-to-br from-purple-600 to-indigo-800 text-white font-sans overflow-hidden">
      <div className="flex flex-col h-full backdrop-blur-sm">
        <header className="p-5 text-center bg-white/10 backdrop-blur-lg border-b border-white/20">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="text-2xl">🔧</div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200 text-shadow">
              WorkTool Pro
            </h1>
          </div>
          <p className="text-sm font-light opacity-80">专业的网页工具套件</p>
        </header>

        <nav className="flex bg-white/10 backdrop-blur-md border-b border-white/20">
          <button
            className={`flex-1 py-4 px-3 text-sm font-medium transition-all duration-300 relative overflow-hidden ${
              activeTab === "tables"
                ? "text-white bg-white/20"
                : "text-white/70 hover:bg-white/10"
            }`}
            onClick={() => setActiveTab("tables")}
          >
            📊 表格工具
            {activeTab === 'tables' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-0.5 bg-gradient-to-r from-red-400 to-yellow-400"></div>}
          </button>
          <button
            className={`flex-1 py-4 px-3 text-sm font-medium transition-all duration-300 relative overflow-hidden ${
              activeTab === "copy"
                ? "text-white bg-white/20"
                : "text-white/70 hover:bg-white/10"
            }`}
            onClick={() => setActiveTab("copy")}
          >
            📋 复制工具
            {activeTab === 'copy' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-0.5 bg-gradient-to-r from-red-400 to-yellow-400"></div>}
          </button>
        </nav>

        <main className="flex-1 p-5 overflow-y-auto">
          {activeTab === "tables" && (
            <TableTools
              sendMessage={sendMessage}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              setMessage={setMessage}
            />
          )}

          {activeTab === "copy" && (
            <CopyTools
              sendMessage={sendMessage}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              setMessage={setMessage}
            />
          )}
        </main>

        {message && (
          <div className={`mx-5 mb-4 p-3 text-sm font-medium text-center rounded-lg backdrop-blur-md border animate-slideIn ${message.includes("失败") ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-green-500/20 border-green-500/30 text-green-300'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
