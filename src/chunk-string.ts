export const chunkString = (id: string, chunkSize: number) =>
  [...id].reduce(
    (acc: string[], curr) => {
      const last = acc[acc.length - 1];

      if (last.length < chunkSize) {
        acc[acc.length - 1] += curr;
      } else {
        acc.push(curr);
      }

      return acc;
    },
    [""],
  );
