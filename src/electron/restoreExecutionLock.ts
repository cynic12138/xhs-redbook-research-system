export class RestoreExecutionLock {
  private active = false;

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active) {
      throw new Error("已有数据恢复正在执行，请等待应用重启或当前操作结束。");
    }
    this.active = true;
    try {
      return await operation();
    } finally {
      this.active = false;
    }
  }
}
