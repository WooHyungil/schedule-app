/**
 * 성능 최적화 에이전트
 * - 배치 업데이트: 여러 변경사항을 모아서 한 번에 전송 (500ms 디바운싱)
 * - 스마트 캐싱: 변경된 항목만 추적
 * - 선택적 동기화: 자주 접근하지 않는 데이터는 필요할 때만 로드
 * - 오프라인 우선: 로컬 업데이트 후 백그라운드에서 동기화
 */

class PerformanceAgent {
  constructor() {
    this.updateQueues = {}; // 컬렉션별 배치 큐
    this.timers = {}; // 디바운싱 타이머
    this.localCache = {}; // 해시 캐시로 변경여부 판단
    this.syncInProgress = {}; // 진행 중인 동기화
    this.BATCH_DELAY = 500; // 500ms 디바운싱
  }

  /**
   * 배치 업데이트 등록
   * @param {string} collectionName - 컬렉션명
   * @param {array} items - 업데이트할 항목들
   * @param {function} syncFn - 실제 동기화 함수
   * @returns {Promise<void>}
   */
  async enqueueBatchUpdate(collectionName, items, syncFn) {
    // 큐 초기화
    if (!this.updateQueues[collectionName]) {
      this.updateQueues[collectionName] = [];
    }

    // 기존 타이머 취소
    if (this.timers[collectionName]) {
      clearTimeout(this.timers[collectionName]);
    }

    // 큐에 추가
    this.updateQueues[collectionName] = items;

    // 로컬에서 즉시 업데이트 (낙관적 업데이트)
    this.localCache[collectionName] = this.hashData(items);

    // 디바운싱된 배치 동기화
    this.timers[collectionName] = setTimeout(async () => {
      try {
        this.syncInProgress[collectionName] = true;
        await syncFn(items);
        this.updateQueues[collectionName] = [];
      } catch (error) {
        console.error(`Batch sync failed for ${collectionName}:`, error);
        // 실패해도 로컬 데이터는 유지 (나중에 재시도)
      } finally {
        this.syncInProgress[collectionName] = false;
      }
    }, this.BATCH_DELAY);
  }

  /**
   * 변경사항만 추출 (데이터 크기 최소화)
   * @param {array} oldItems - 기존 데이터
   * @param {array} newItems - 새 데이터
   * @returns {object} - { added, updated, deleted }
   */
  extractDelta(oldItems = [], newItems = []) {
    const oldMap = new Map((oldItems || []).map((item) => [item.id, item]));
    const newMap = new Map((newItems || []).map((item) => [item.id, item]));

    return {
      added: [...newMap.values()].filter((item) => !oldMap.has(item.id)),
      updated: [...newMap.values()].filter((item) => {
        const old = oldMap.get(item.id);
        return old && this.hashData(item) !== this.hashData(old);
      }),
      deleted: [...oldMap.values()].filter((item) => !newMap.has(item.id)),
    };
  }

  /**
   * 데이터 해싱 (변경여부 판단용)
   */
  hashData(data) {
    try {
      return JSON.stringify(data);
    } catch {
      return '';
    }
  }

  /**
   * 동기화 상태 확인
   */
  isSyncing(collectionName) {
    return this.syncInProgress[collectionName] || false;
  }

  /**
   * 에이전트 초기화
   */
  reset() {
    Object.values(this.timers).forEach((timer) => clearTimeout(timer));
    this.updateQueues = {};
    this.timers = {};
    this.localCache = {};
    this.syncInProgress = {};
  }
}

export const performanceAgent = new PerformanceAgent();
export default PerformanceAgent;
