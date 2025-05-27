import OpenAI from "openai";
import fs from 'fs';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "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",
});

const tools = [
  {
    type: "function",
    function: {
      name: "analyze_log",
      description: "分析 log，判斷是否為攻擊並給出建議",
      parameters: {
        type: "object",
        properties: {
          is_attack: { type: "boolean" },
          need_test_command: { type: "boolean" },
          shell_script: { type: "string" },
          general_response: { type: "string" },
          problematic_lines: { 
            type: "array",
            items: {
              type: "object",
              properties: {
                line_number: { type: "number" },
                line_content: { type: "string" },
                error_type: { type: "string" }
              }
            }
          }
        },
        required: ["is_attack", "need_test_command", "general_response", "problematic_lines"]
      }
    }
  }
];

// 驗證 JSON 格式是否完整
function validateJSON(json) {
  const requiredFields = ['is_attack', 'need_test_command', 'general_response', 'problematic_lines'];
  const missingFields = requiredFields.filter(field => !(field in json));
  
  if (missingFields.length > 0) {
    throw new Error(`缺少必要欄位: ${missingFields.join(', ')}`);
  }
  
  if (!Array.isArray(json.problematic_lines)) {
    throw new Error('problematic_lines 必須是陣列');
  }
  
  json.problematic_lines.forEach((line, index) => {
    if (!line.line_number || !line.line_content || !line.error_type) {
      throw new Error(`problematic_lines[${index}] 缺少必要欄位`);
    }
  });
  
  return true;
}

async function main() {
  try {
    console.log("開始發送請求...");
    
    // 讀取 log 檔案
    const logContent = fs.readFileSync('nginx_access_log_sample.txt', 'utf8');
    
    const completion = await openai.chat.completions.create({
      model: "anthropic/claude-3-haiku",
      messages: [
        {
          role: "user",
          content: `Please analyze the following log and return the result using the analyze_log function.
The return format must strictly follow the JSON structure below and include all required fields:
{
  "is_attack": true/false,                 // Whether this is an attack behavior
  "need_test_command": true/false,        // Whether a test command is needed for further verification
  "shell_script": "test command or empty string", // If a test is needed, provide the test command; otherwise, use an empty string
  "general_response": "overall attack description", // General description of the attack
  "problematic_lines":                   // Lines in the log that are problematic
    {
      "line_number": integer,                // Line number of the problematic entry (starting from 1)
      "line_content": "original log content", // The original content of that line
      "error_type": "description of the error type" // Type of issue (e.g., SQL Injection, XSS, Path Traversal, etc.)
    }
}


Please analyze the following log:
${logContent}

Notes:

You must return the result using a function call.

All required fields must be included; none can be omitted.

problematic_lines must list all problematic lines in the log.

Each problematic line must include the line number, original content, and error type.

The error type must be specific (e.g., SQL Injection, XSS attack, Path Traversal, etc.).

The JSON format must be complete and must not be missing the closing curly brace.`
        }
      ],
      tools: tools,
      tool_choice: { type: "function", function: { name: "analyze_log" } },
      max_tokens: 1000
    });

    console.log("收到 API 回應");
    
    if (completion.choices && completion.choices[0] && completion.choices[0].message) {
      const message = completion.choices[0].message;
      console.log("\n模型回應：", message);

      // 檢查是否有 function call
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        if (toolCall.function && toolCall.function.arguments) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            
            // 驗證 JSON 格式
            try {
              validateJSON(args);
              console.log("\n✅ JSON 格式驗證通過");
              console.log("\n解析後的 JSON：", args);
              
              // 顯示有問題的行數和錯誤
              if (args.problematic_lines && args.problematic_lines.length > 0) {
                console.log("\n有問題的行數：");
                args.problematic_lines.forEach(line => {
                  console.log(`\n行數 ${line.line_number}:`);
                  console.log(`內容: ${line.line_content}`);
                  console.log(`錯誤類型: ${line.error_type}`);
                });
              }
            } catch (validationError) {
              console.error("❌ JSON 格式驗證失敗：", validationError.message);
              console.log("原始內容：", toolCall.function.arguments);
            }
          } catch (err) {
            console.error("❌ JSON 解析失敗：", err);
            console.log("原始內容：", toolCall.function.arguments);
          }
        } else {
          console.error("❌ function call 缺少 arguments");
        }
      } else {
        console.error("❌ 沒有 function call");
        console.log("完整回應：", message);
      }
    } else {
      console.log("模型回應格式不正確：", completion);
    }
  } catch (error) {
    console.error("發生錯誤：", error);
    if (error.response) {
      console.error("API 回應：", error.response.data);
    }
  }
}

console.log("程式開始執行...");
main().catch(error => {
  console.error("主程式錯誤：", error);
});