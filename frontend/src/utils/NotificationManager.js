
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notification");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
};

export const showNotification = (title, options, onClickHandler) => {
  if (Notification.permission === "granted") {
    const notification = new Notification(title, options);
    notification.onclick = onClickHandler;
    return notification;
  }
  return null;
};