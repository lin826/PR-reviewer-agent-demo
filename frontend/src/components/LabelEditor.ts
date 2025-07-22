import { apiClient } from '../services/api.js';
import type { Label } from '../types/index.js';

export class LabelEditor {
  private textareaElement: HTMLTextAreaElement;
  private saveButton: HTMLButtonElement;
  private currentProblemId: string | null = null;
  private currentAgentName: string | null = null;
  private currentLabel: Label | null = null;
  private hasUnsavedChanges: boolean = false;

  constructor(
    textareaElement: HTMLTextAreaElement,
    saveButton: HTMLButtonElement
  ) {
    this.textareaElement = textareaElement;
    this.saveButton = saveButton;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Track changes in textarea
    this.textareaElement.addEventListener('input', () => {
      this.hasUnsavedChanges = true;
      this.updateButtonStates();
    });

    // Save button
    this.saveButton.addEventListener('click', async () => {
      await this.saveLabel();
    });

    // Auto-save on Ctrl+S / Cmd+S
    this.textareaElement.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveLabel();
      }
    });
  }

  public async loadLabel(
    problemId: string | null,
    agentName: string | null
  ): Promise<void> {
    this.currentProblemId = problemId;
    this.currentAgentName = agentName;

    // Clear state when no problem/agent selected
    if (!problemId || !agentName) {
      this.clearEditor();
      this.updatePlaceholder();
      return;
    }

    try {
      console.log(`Loading label for ${problemId}/${agentName}...`);

      // Try to load existing label
      try {
        this.currentLabel = await apiClient.getLabel(problemId, agentName);
        console.log('API returned label:', this.currentLabel);

        if (this.currentLabel && this.currentLabel.content) {
          this.textareaElement.value = this.currentLabel.content;
          console.log(
            `Loaded existing label: ${this.currentLabel.content.length} chars`
          );
        } else {
          console.log('Label exists but has no content');
          this.currentLabel = null;
          this.textareaElement.value = '';
        }
      } catch (error) {
        // 404 means no label exists yet - that's fine
        if (error instanceof Error && error.message.includes('404')) {
          console.log('No existing label found - starting fresh');
          this.currentLabel = null;
          this.textareaElement.value = '';
        } else {
          console.error('Error loading label:', error);
          throw error;
        }
      }

      this.hasUnsavedChanges = false;
      this.enableEditor();
      this.updateButtonStates();
    } catch (error) {
      console.error(
        `Failed to load label for ${problemId}/${agentName}:`,
        error
      );
      this.setError('Failed to load comment');
    }
  }

  private async saveLabel(): Promise<void> {
    if (!this.currentProblemId || !this.currentAgentName) {
      return;
    }

    const content = this.textareaElement.value.trim();

    try {
      this.setSaving(true);

      if (content) {
        // Save label
        this.currentLabel = await apiClient.saveLabel(
          this.currentProblemId,
          this.currentAgentName,
          content
        );
        console.log(`Label saved successfully: ${content.length} chars`);
        this.showSuccessMessage();
      } else {
        // Delete label if content is empty
        if (this.currentLabel) {
          await apiClient.deleteLabel(
            this.currentProblemId,
            this.currentAgentName
          );
          this.currentLabel = null;
          console.log('Label deleted successfully');
          this.showSuccessMessage('Comment deleted');
        }
      }

      this.hasUnsavedChanges = false;
      this.updateButtonStates();
    } catch (error) {
      console.error('Failed to save label:', error);
      this.showErrorMessage('Failed to save comment');
    } finally {
      this.setSaving(false);
    }
  }

  private clearEditor(): void {
    this.textareaElement.value = '';
    this.currentLabel = null;
    this.hasUnsavedChanges = false;
    this.disableEditor();
  }

  private enableEditor(): void {
    this.textareaElement.disabled = false;
    this.textareaElement.placeholder =
      "Add your comments about this agent's solution...\n\nSupports Markdown formatting:\n- **bold** and *italic*\n- `code` blocks\n- Lists and links";
  }

  private disableEditor(): void {
    this.textareaElement.disabled = true;
    this.updateButtonStates();
  }

  private updatePlaceholder(): void {
    if (!this.currentProblemId) {
      this.textareaElement.placeholder =
        'Select a problem and agent to add comments...';
    } else if (!this.currentAgentName) {
      this.textareaElement.placeholder = 'Select an agent to add comments...';
    }
  }

  private updateButtonStates(): void {
    const hasContent = this.textareaElement.value.trim().length > 0;
    const canSave =
      !this.textareaElement.disabled &&
      (this.hasUnsavedChanges || (!this.currentLabel && hasContent));

    this.saveButton.disabled = !canSave;

    // Update save button text based on state
    if (this.saveButton.textContent !== 'Saving...') {
      this.saveButton.textContent = 'Save';
    }
  }

  private setSaving(saving: boolean): void {
    this.saveButton.disabled = saving;
    this.textareaElement.disabled = saving;

    if (saving) {
      this.saveButton.textContent = 'Saving...';
    } else {
      this.updateButtonStates();
    }
  }

  private setError(message: string): void {
    this.textareaElement.placeholder = message;
    this.disableEditor();
  }

  private showSuccessMessage(_message: string = 'Comment saved'): void {
    // Show temporary success indicator
    const _originalText = this.saveButton.textContent;
    this.saveButton.textContent = '✓ Saved';
    this.saveButton.style.backgroundColor = '#28a745';

    setTimeout(() => {
      this.saveButton.style.backgroundColor = '';
      this.updateButtonStates();
    }, 2000);
  }

  private showErrorMessage(_message: string): void {
    // Show temporary error indicator
    const _originalText = this.saveButton.textContent;
    this.saveButton.textContent = '✗ Error';
    this.saveButton.style.backgroundColor = '#dc3545';

    setTimeout(() => {
      this.saveButton.style.backgroundColor = '';
      this.updateButtonStates();
    }, 3000);
  }

  public getCurrentProblem(): string | null {
    return this.currentProblemId;
  }

  public getCurrentAgent(): string | null {
    return this.currentAgentName;
  }

  public hasChanges(): boolean {
    return this.hasUnsavedChanges;
  }
}
