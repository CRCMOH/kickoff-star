package com.vraxis.kickoffstar;

import android.os.Bundle;
 import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onBackPressed() {
    if (bridge != null && bridge.getWebView() != null) {
      bridge.getWebView().evaluateJavascript(
        "window.dispatchEvent(new Event('kickoffstar:native-back'))", null);
      return;
    }
    super.onBackPressed();
  }

  @Override
  protected void onPause() {
    super.onPause();
    if (bridge != null && bridge.getWebView() != null) bridge.getWebView().onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (bridge != null && bridge.getWebView() != null) bridge.getWebView().onResume();
  }
}
