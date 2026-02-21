import { Connector, InteractionCandidate } from "./index";

/**
 * Manual Import Connector
 * Receives interactions pushed from the UI/API and queues them for the next pull cycle.
 */
class ManualConnectorImpl implements Connector {
  public id = "manual-import";
  private inboxBuffer: InteractionCandidate[] = [];

  /**
   * Pushes a new candidate into the buffer directly from an API endpoint.
   */
  public push(candidate: Omit<InteractionCandidate, "source_kind" | "timestamp">) {
    this.inboxBuffer.push({
      ...candidate,
      source_kind: "manual",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Pulls all pending candidates and clears the buffer.
   */
  public async pull(): Promise<InteractionCandidate[]> {
    const pulled = [...this.inboxBuffer];
    this.inboxBuffer = [];
    return pulled;
  }
}

export const manualConnector = new ManualConnectorImpl();
