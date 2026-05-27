// src/features/onboarding.js
import { $ } from '../ui/dom.js';
import { state, saveState, resetState } from '../core/state.js';
import { closeModalAnimated } from '../ui/modal.js';

let onResetComplete = null;

export function setResetCompleteCallback(cb) {
  onResetComplete = cb;
}

export function checkOnboarding() {
  const modal = $('#modal-onboarding');
  if (!state.onboardingDone && modal) {
    modal.showModal();
  }
}

export function initOnboarding() {
  const modal = $('#modal-onboarding');
  const btnStart = $('#btn-onboarding-start');
  const btnClean = $('#btn-onboarding-clean');

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      state.onboardingDone = true;
      saveState();
      closeModalAnimated(modal);
    });
  }

  if (btnClean) {
    btnClean.addEventListener('click', () => {
      resetState();
      state.onboardingDone = true;
      state.tasks = [];
      saveState();
      closeModalAnimated(modal);
      if (onResetComplete) onResetComplete();
    });
  }
}
