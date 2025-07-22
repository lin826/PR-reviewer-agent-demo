import { apiClient } from '../services/api.js';
import type { Agent } from '../types/index.js';

export class AgentSelector {
  private element: HTMLSelectElement;
  private agents: Agent[] = [];
  private onChangeCallback?: (_agentName: string | null) => void;

  constructor(element: HTMLSelectElement) {
    this.element = element;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.element.addEventListener('change', () => {
      const selectedAgent = this.element.value || null;
      console.log('Agent selected:', selectedAgent);

      if (this.onChangeCallback) {
        this.onChangeCallback(selectedAgent);
      }
    });
  }

  public onChange(callback: (_agentName: string | null) => void): void {
    this.onChangeCallback = callback;
  }

  public async loadAgents(): Promise<void> {
    try {
      console.log('Loading agents...');
      this.setLoading(true);

      this.agents = await apiClient.getAgents();
      console.log(
        `Loaded ${this.agents.length} agents:`,
        this.agents.map((a) => a.name)
      );

      this.populateDropdown();
      this.setLoading(false);
    } catch (error) {
      console.error('Failed to load agents:', error);
      this.setError();
    }
  }

  private populateDropdown(): void {
    // Clear existing options except the placeholder
    this.element.innerHTML = '<option value="">Select Agent...</option>';

    // Sort agents by success rate (descending) then by name
    const sortedAgents = [...this.agents].sort((a, b) => {
      if (b.success_rate !== a.success_rate) {
        return b.success_rate - a.success_rate;
      }
      return a.display_name.localeCompare(b.display_name);
    });

    // Add agent options
    sortedAgents.forEach((agent) => {
      const option = document.createElement('option');
      option.value = agent.name;
      option.textContent = `${agent.display_name} (${(agent.success_rate * 100).toFixed(1)}% - ${agent.resolved_problems}/${agent.total_problems})`;
      this.element.appendChild(option);
    });

    console.log(`Populated agent dropdown with ${sortedAgents.length} options`);
  }

  private setLoading(loading: boolean): void {
    this.element.disabled = loading;

    if (loading) {
      this.element.innerHTML = '<option value="">Loading agents...</option>';
    }
  }

  private setError(): void {
    this.element.disabled = true;
    this.element.innerHTML = '<option value="">Failed to load agents</option>';
  }

  public getSelectedAgent(): string | null {
    return this.element.value || null;
  }

  public setSelectedAgent(agentName: string | null): void {
    this.element.value = agentName || '';

    // Trigger change event to notify listeners
    const event = new Event('change');
    this.element.dispatchEvent(event);
  }

  public getAgentByName(name: string): Agent | undefined {
    return this.agents.find((agent) => agent.name === name);
  }

  public enable(): void {
    this.element.disabled = false;
  }

  public disable(): void {
    this.element.disabled = true;
  }
}
