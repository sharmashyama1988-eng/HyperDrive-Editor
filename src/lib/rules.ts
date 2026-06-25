import { tauriFS } from "./tauriFS";

const BASE_DIR = "C:/HyperDrive";
const RULES_PATH = `${BASE_DIR}/config/rules.txt`;

export const rulesManager = {
  /**
   * Appends a new rule to C:\HyperDrive\config\rules.txt
   */
  async addRule(ruleText: string): Promise<string> {
    try {
      // Ensure config directory exists
      await tauriFS.createFolder(`${BASE_DIR}/config`);

      let currentRules = "";
      try {
        currentRules = await tauriFS.getFileContent(RULES_PATH);
      } catch {
        // File doesn't exist yet, which is fine
      }

      const updatedRules = `${currentRules}\n- ${ruleText.trim()}`.trim();
      await tauriFS.saveFile(RULES_PATH, updatedRules);
      return "Rule added to AI memory successfully!";
    } catch (e: any) {
      console.error(e);
      return `Failed to save rule: ${e.message || e}`;
    }
  },

  /**
   * Reads all rules from C:\HyperDrive\config\rules.txt
   */
  async getRules(): Promise<string> {
    try {
      return await tauriFS.getFileContent(RULES_PATH);
    } catch {
      return "No custom rules defined yet. Type '/rule <your rule>' to add one.";
    }
  },

  /**
   * Clears rules file
   */
  async clearRules(): Promise<void> {
    try {
      await tauriFS.saveFile(RULES_PATH, "");
    } catch (e) {
      console.error(e);
    }
  }
};
