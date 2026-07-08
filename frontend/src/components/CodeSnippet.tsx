import { useState } from "react";
import { Button, Tooltip, message } from "antd";
import { CopyOutlined, CheckOutlined } from "@ant-design/icons";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeSnippetProps {
  language: string;
  code: string;
  maxHeight?: number;
}

export default function CodeSnippet({ language, code, maxHeight }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      message.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ position: "relative", marginTop: 8, marginBottom: 8 }}>
      <Tooltip title={copied ? "Copied!" : "Copy code"}>
        <Button 
          type="text" 
          icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined style={{ color: '#aaa' }} />} 
          onClick={handleCopy}
          style={{ 
            position: "absolute", 
            top: 12, 
            right: 12, 
            zIndex: 10,
            background: "rgba(255,255,255,0.1)",
            border: "none",
          }}
        />
      </Tooltip>
      <SyntaxHighlighter 
        language={language} 
        style={vscDarkPlus} 
        customStyle={{ 
          borderRadius: 8, 
          fontSize: 13, 
          margin: 0,
          maxHeight: maxHeight ? maxHeight : undefined,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
