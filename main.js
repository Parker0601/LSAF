import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "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",
});

async function main() {
    try {
        console.log("開始分析日誌...");
        
        // 讀取 log 檔案
        const logContent = fs.readFileSync('attack_logs_apache_style.txt', 'utf8');
        
        // 檢查檔案內容是否為空
        if (!logContent.trim()) {
            console.error("錯誤：檔案內容為空");
            return;
        }

        const completion = await openai.chat.completions.create({
            model: "meta-llama/llama-4-scout:free",
            messages: [
              {
                role: "system",
                content: `
請根據輸入的 Web Log 或系統日誌，分析是否為攻擊行為，並根據下列規則輸出一段 JSON 格式的結果。

僅在確認為真實攻擊時，才將 "is_attack" 設為 true。

當 "is_attack" 為 true 時，請依照以下順序執行：
1. 產出對應處理指令（shell_script），針對此次攻擊採取立即反制行為。
2. 解釋每條指令的功能、用途與風險（script_explanation）。
3. 最後提供詳細的攻擊說明與處理建議（general_response），包括：
   - 攻擊類型與手法
   - 攻擊者可能使用的工具（如 sqlmap、dirbuster、hydra 等）
   - 潛在風險
   - 防禦方式與建議設定（如 ModSecurity、Fail2Ban、Suricata、OWASP CRS 等）
   - 安裝方式、設定範例
   - 若適用，提供 CVE 編號與修補方式


分析以下 log：
${logContent}

不管給的請僅回傳以下 JSON 格式，不要附加其他說明文字：

{
  "is_attack": true/false,
  "shell_script": "若為攻擊行為則提供對應指令",
  "script_explanation": "逐條說明 shell_script 的指令用途與風險",
  "general_response": "針對本次攻擊的綜合說明與防禦建議"
}

`

//                 content: `
// Please return the analysis result in strict JSON format only, with no additional explanation or formatting:

// {
//   "is_attack": true/false,                 // Whether this is an attack behavior (analyze strictly; avoid false positives. Only mark true if there is sufficient evidence)
//   "need_test_command": true/false,        // Whether a sandbox test command is required (if you are not confident about the generated command, set to true so the system can test it safely first)
//   "shell_script": "test command or empty string", // If need_test_command is true, provide a proper test command with clear purpose and function
//   "general_response": "attack explanation and handling suggestions" // A comprehensive description of the attack. Must include: method of attack, potential risks, explanation of relevant tools, possible intent, and concrete suggestions for mitigation or defense (e.g., security patching, configuration, server hardening, etc.). Be as detailed as possible
// }

// Notes:
// 1. If need_test_command is true, you must provide a corresponding shell_script command
// 2. Be cautious when determining is_attack — avoid misjudging normal traffic as attacks; only mark as true when there is concrete evidence from the log (e.g., unusual paths, suspicious user-agents, known attack payloads, etc.)
// 3. If you are highly confident in the shell_script command (i.e., it won't cause unintended damage), you can set need_test_command to false and allow the admin to use it directly. If not confident, set to true so the system will verify it in a sandbox first
// 4. The system will use the need_test_command value to decide whether sandbox testing is needed. If sandbox feedback is returned, it will be provided to you for reference so you can regenerate the command accordingly. Therefore, ensure the shell_script is logically clear and easily adjustable
// 5. Do not use markdown grammar in your response

// Analyze the following log:
// ${logContent}

// `
              }
            ]
          });
          
        console.log(`收到 API 回應`);
        
        if (completion.choices && completion.choices[0] && completion.choices[0].message) {
            console.log(`\n模型回應：`);
            console.log(completion.choices[0].message);
            
            try {
                const content = completion.choices[0].message.content;
                if (!content) {
                    console.log("模型回應內容為空");
                    return;
                }
                
                // 使用正則表達式提取 JSON 部分
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    const json = JSON.parse(jsonStr);
                    console.log(`\n解析後的 JSON：`, json);
                } else {
                    console.error("❌ 無法找到 JSON 內容");
                    console.log("原始內容：", content);
                }
            } catch (err) {
                console.error("❌ JSON 解析失敗：", err);
                console.log("原始內容：", completion.choices[0].message.content);
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