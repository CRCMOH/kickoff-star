package com.vraxis.kickoffstar;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onBackPressed() {
    if (bridge != null && bridge.getWebView() != null && bridge.getWebView().canGoBack()) {
      bridge.getWebView().goBack();
    } else {
      super.onBackPressed();
    }
  }
}
