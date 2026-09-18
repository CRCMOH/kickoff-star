package com.vraxis.kickoffstar;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private OnBackPressedCallback backCallback;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    backCallback = new OnBackPressedCallback(true) {
      @Override public void handleOnBackPressed() {
        if (bridge != null && bridge.getWebView() != null && bridge.getWebView().canGoBack()) {
          bridge.getWebView().goBack();
        } else {
          setEnabled(false);
          getOnBackPressedDispatcher().onBackPressed();
          setEnabled(true);
        }
      }
    };
    getOnBackPressedDispatcher().addCallback(this, backCallback);
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
