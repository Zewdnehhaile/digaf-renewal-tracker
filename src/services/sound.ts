class SoundService {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Play a pleasant 2-note ascending sound when a new renewal is successfully created
   */
  playSuccessChime() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const t = this.ctx.currentTime;
      
      // Note 1: E5 (659.25 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, t);
      
      gain1.gain.setValueAtTime(0, t);
      gain1.gain.linearRampToValueAtTime(0.45, t + 0.05);
      gain1.gain.setValueAtTime(0.45, t + 0.15);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.35);

      // Note 2: A5 (880.00 Hz) slightly staggered
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, t + 0.10);
      
      gain2.gain.setValueAtTime(0, t + 0.10);
      gain2.gain.linearRampToValueAtTime(0.55, t + 0.15);
      gain2.gain.setValueAtTime(0.55, t + 0.28);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(t + 0.10);
      osc2.stop(t + 0.55);
    } catch (e) {
      console.warn('AudioContext failed to trigger sound chime:', e);
    }
  }

  /**
   * Play a unique 2-note descending minor/cautionary sound for late clock-ins
   */
  playLateWarningChime() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const t = this.ctx.currentTime;
      
      // Note 1: E4 (329.63 Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle'; // triangle has a softer buzzer quality
      osc1.frequency.setValueAtTime(329.63, t);
      
      gain1.gain.setValueAtTime(0, t);
      gain1.gain.linearRampToValueAtTime(0.40, t + 0.05);
      gain1.gain.setValueAtTime(0.40, t + 0.20);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
      
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.40);

      // Note 2: Bb3 (233.08 Hz) - Tritone / Cautionary interval, slightly delayed
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(233.08, t + 0.15);
      
      gain2.gain.setValueAtTime(0, t + 0.15);
      gain2.gain.linearRampToValueAtTime(0.45, t + 0.20);
      gain2.gain.setValueAtTime(0.45, t + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.60);
      
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(t + 0.15);
      osc2.stop(t + 0.60);
    } catch (e) {
      console.warn('AudioContext failed to trigger voice/late sound effect:', e);
    }
  }

  /**
   * Play an elegant 3-note ascending arpeggio when bulk cohort import completes
   */
  playBulkCompleteChime() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      
      const t = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);
        
        gain.gain.setValueAtTime(0, t + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.40, t + idx * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.32);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.32);
      });
    } catch (e) {
      console.warn('AudioContext failed to trigger sound chime:', e);
    }
  }

  /**
   * Play a low, distinct warning double beep for rejected scans
   */
  playErrorChime() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      
      const t = this.ctx.currentTime;
      
      // Beep 1
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(150, t);
      gain1.gain.setValueAtTime(0, t);
      gain1.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.2);

      // Beep 2
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(150, t + 0.12);
      gain2.gain.setValueAtTime(0, t + 0.12);
      gain2.gain.linearRampToValueAtTime(0.3, t + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(t + 0.12);
      osc2.stop(t + 0.32);
    } catch (e) {
      console.warn('AudioContext failed to trigger error sound effect:', e);
    }
  }
}

export const soundService = new SoundService();
