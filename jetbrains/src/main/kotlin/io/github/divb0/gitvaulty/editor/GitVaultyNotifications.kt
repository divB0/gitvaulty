package io.github.divb0.gitvaulty.editor

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project

internal object GitVaultyNotifications {
  fun error(project: Project, message: String) {
    NotificationGroupManager.getInstance()
      .getNotificationGroup("GitVaulty")
      .createNotification("GitVaulty", message, NotificationType.ERROR)
      .notify(project)
  }

  fun warning(project: Project, message: String) {
    NotificationGroupManager.getInstance()
      .getNotificationGroup("GitVaulty")
      .createNotification("GitVaulty", message, NotificationType.WARNING)
      .notify(project)
  }

  fun info(project: Project, message: String) {
    NotificationGroupManager.getInstance()
      .getNotificationGroup("GitVaulty")
      .createNotification("GitVaulty", message, NotificationType.INFORMATION)
      .notify(project)
  }
}
